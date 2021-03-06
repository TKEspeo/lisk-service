/*
 * LiskHQ/lisk-service
 * Copyright © 2020 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */
const { CacheRedis, Logger } = require('lisk-service-framework');
const BluebirdPromise = require('bluebird');
const semver = require('semver');
const {
	TransferTransaction,
	DelegateTransaction,
	MultisignatureTransaction,
	VoteTransaction,
	UnlockTransaction,
	ProofOfMisbehaviorTransaction,
} = require('@liskhq/lisk-transactions');

const config = require('../../config.js');

// const { getCoreVersion } = require('./helpers/coreVersionCompatibility');
const { getCoreVersion, getBlocks, getTransactions } = require('./compat');

const logger = Logger();

const cacheRedisFees = CacheRedis('fees', config.endpoints.redis);

const calcAvgFeeByteModes = {
	MEDIUM: 'med',
	HIGH: 'high',
};

const getTransactionInstanceByType = transaction => {
	const transactionMap = {
		8: TransferTransaction,
		10: DelegateTransaction,
		12: MultisignatureTransaction,
		13: VoteTransaction,
		14: UnlockTransaction,
		15: ProofOfMisbehaviorTransaction,
	};

	const TransactionClass = transactionMap[transaction.type];
	const tx = new TransactionClass(transaction);
	return tx;
};

const calculateBlockSize = block => {
	let blockSize = 0;
	if (block.numberOfTransactions === 0) return blockSize;

	const payload = block.transactions.data;
	const transactionSizes = payload.map(transaction => {
		const tx = getTransactionInstanceByType(transaction);
		const transactionSize = tx.getBytes().length;
		return transactionSize;
	});

	blockSize = transactionSizes.reduce((a, b) => a + b);
	return blockSize;
};

const calculateWeightedAvg = blocks => {
	const blockSizes = blocks.map(block => calculateBlockSize(block));
	const decayFactor = config.feeEstimates.wavgDecayPercentage / 100;
	let weight = 1;
	const wavgLastBlocks = blockSizes.reduce((a, b) => {
		weight *= 1 - decayFactor;
		return a + (b * weight);
	});

	return wavgLastBlocks;
};

const calculateAvgFeePerByte = (mode, transactionDetails) => {
	const maxBlockSize = 15 * 2 ** 10;
	const allowedModes = Object.values(calcAvgFeeByteModes);

	const lowerPercentile = allowedModes.includes(mode) && mode === calcAvgFeeByteModes.MEDIUM
		? config.feeEstimates.medEstLowerPercentile : config.feeEstimates.highEstLowerPercentile;
	const upperPercentile = allowedModes.includes(mode) && mode === calcAvgFeeByteModes.MEDIUM
		? config.feeEstimates.medEstUpperPercentile : config.feeEstimates.highEstUpperPercentile;
	const lowerBytePos = Math.ceil((lowerPercentile / 100) * maxBlockSize);
	const upperBytePos = Math.floor((upperPercentile / 100) * maxBlockSize);

	let currentBytePos = 0;
	let totalFeePriority = 0;
	transactionDetails.forEach(transaction => {
		if (currentBytePos <= lowerBytePos && lowerBytePos < currentBytePos + transaction.size
			&& currentBytePos + transaction.size <= upperBytePos) {
			totalFeePriority += transaction.feePriority
				* (currentBytePos + transaction.size - lowerBytePos + 1);
		}

		if (lowerBytePos <= currentBytePos && currentBytePos + transaction.size <= upperBytePos) {
			totalFeePriority += transaction.feePriority * transaction.size;
		}

		if (lowerBytePos <= currentBytePos && upperBytePos >= currentBytePos
			&& upperBytePos <= currentBytePos + transaction.size) {
			totalFeePriority += transaction.feePriority * (upperBytePos - currentBytePos + 1);
		}

		currentBytePos += transaction.size;
	});

	const avgFeePriority = totalFeePriority / (upperBytePos - lowerBytePos + 1);
	return avgFeePriority;
};

const calculateFeePerByte = block => {
	const feePerByte = {};
	const payload = block.transactions.data;
	const transactionDetails = payload.map(transaction => {
		const tx = getTransactionInstanceByType(transaction);
		const transactionSize = tx.getBytes().length;
		const { minFee } = tx;
		const feePriority = (Number(transaction.fee) - Number(minFee)) / transactionSize;
		return {
			id: transaction.id,
			size: transactionSize,
			feePriority,
		};
	});
	transactionDetails.sort((t1, t2) => t1.feePriority - t2.feePriority);

	const blockSize = calculateBlockSize(block);

	feePerByte.low = (blockSize < 12.5 * 2 ** 10) ? 0 : transactionDetails[0].feePriority;
	feePerByte.med = calculateAvgFeePerByte(calcAvgFeeByteModes.MEDIUM, transactionDetails);
	feePerByte.high = Math.max(calculateAvgFeePerByte(calcAvgFeeByteModes.HIGH, transactionDetails),
		(1.3 * feePerByte.med + 1));

	return feePerByte;
};

const EMAcalc = (feePerByte, prevFeeEstPerByte) => {
	const calcExpDecay = (emaBatchSize, emaDecayRate) => (
		1 - Math.pow(1 - emaDecayRate, 1 / emaBatchSize)).toFixed(5);

	const alpha = calcExpDecay(config.feeEstimates.emaBatchSize, config.feeEstimates.emaDecayRate);
	logger.info(`Estimating fees with 'α' for EMA set to ${alpha}.`);

	const feeEst = {};
	if (Object.keys(prevFeeEstPerByte).length === 0) prevFeeEstPerByte = { low: 0, med: 0, high: 0 };
	Object.keys(feePerByte).forEach((property) => {
		feeEst[property] = alpha * feePerByte[property] + (1 - alpha) * prevFeeEstPerByte[property];
	});

	const EMAoutput = {
		feeEstLow: feeEst.low,
		feeEstMed: feeEst.med,
		feeEstHigh: feeEst.high,
	};
	return EMAoutput;
};

const getEstimateFeeByteCoreLogic = async (blockBatch, innerPrevFeeEstPerByte) => {
	const wavgBlockBatch = calculateWeightedAvg(blockBatch.data);
	const sizeLastBlock = calculateBlockSize(blockBatch.data[0]);
	const feePerByte = calculateFeePerByte(blockBatch.data[0]);
	const feeEstPerByte = {};

	if (wavgBlockBatch > (12.5 * 2 ** 10) || sizeLastBlock > (14.8 * 2 ** 10)) {
		const EMAoutput = EMAcalc(feePerByte, innerPrevFeeEstPerByte);

		feeEstPerByte.low = EMAoutput.feeEstLow;
		feeEstPerByte.med = EMAoutput.feeEstMed;
		feeEstPerByte.high = EMAoutput.feeEstHigh;
	} else {
		feeEstPerByte.low = 0;
		feeEstPerByte.med = 0;
		feeEstPerByte.high = 0;
	}

	feeEstPerByte.updated = Math.floor(Date.now() / 1000);
	feeEstPerByte.blockHeight = blockBatch.data[0].height;
	feeEstPerByte.blockId = blockBatch.data[0].id;

	return feeEstPerByte;
};

const getEstimateFeeByte = async () => {
	const coreVersion = getCoreVersion();
	if (semver.lt(coreVersion, '3.0.0-beta.1')) {
		return { data: { error: `Action not supported for Lisk Core version: ${coreVersion}.` } };
	}

	const cacheKeyFeeEst = 'lastFeeEstimate';

	const prevFeeEstPerByte = { blockHeight: config.feeEstimates.defaultStartBlockHeight };
	const cachedFeeEstPerByte = await cacheRedisFees.get(cacheKeyFeeEst);
	const latestBlock = await getBlocks({ sort: 'height:desc', limit: 1 });
	if (cachedFeeEstPerByte
		&& ['low', 'med', 'high', 'updated', 'blockHeight', 'blockId']
			.every(key => Object.keys(cachedFeeEstPerByte).includes(key))) {
		if ((Date.now() / 1000) - cachedFeeEstPerByte.updated < 10
			|| Number(latestBlock.data.id) === cachedFeeEstPerByte.blockHeight) {
			return cachedFeeEstPerByte;
		}

		Object.assign(prevFeeEstPerByte, cachedFeeEstPerByte);
	}

	const range = size => Array(size).fill().map((_, index) => index);
	const feeEstPerByte = {};
	const blockBatch = {};
	do {
		/* eslint-disable no-await-in-loop */
		const batchSize = config.feeEstimates.emaBatchSize;
		blockBatch.data = await BluebirdPromise.map(range(batchSize), async i => (await getBlocks({
			height: prevFeeEstPerByte.blockHeight + 1 - i,
		})).data[0], { concurrency: batchSize });

		blockBatch.data = await BluebirdPromise.map(blockBatch.data, async block => Object
			.assign(block, { transactions: await getTransactions({ blockId: block.id }) }),
			{ concurrency: blockBatch.data.length });

		Object.assign(prevFeeEstPerByte,
			await getEstimateFeeByteCoreLogic(blockBatch, prevFeeEstPerByte));

		if (prevFeeEstPerByte.blockHeight !== latestBlock.data[0].height) {
			// Store intermediate values, in case of a long running loop
			await cacheRedisFees.set(cacheKeyFeeEst, prevFeeEstPerByte);
		}
		/* eslint-enable no-await-in-loop */
	} while (latestBlock.data[0].height > prevFeeEstPerByte.blockHeight);

	Object.assign(feeEstPerByte, prevFeeEstPerByte);
	await cacheRedisFees.set(cacheKeyFeeEst, feeEstPerByte);

	return feeEstPerByte;
};

module.exports = {
	EMAcalc,
	getEstimateFeeByte,
	getEstimateFeeByteCoreLogic,
	getTransactionInstanceByType,
	calculateBlockSize,
	calculateFeePerByte,
	calcAvgFeeByteModes,
	calculateAvgFeePerByte,
	calculateWeightedAvg,
};
