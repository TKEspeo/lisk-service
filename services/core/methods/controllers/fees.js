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
const { HTTP } = require('lisk-service-framework');
const semver = require('semver');

const { getCoreVersion } = require('../../shared/coreVersionCompatibility');
const CoreService = require('../../shared/core.js');

const { StatusCodes: { NOT_FOUND } } = HTTP;

const getEstimateFeeByte = async () => {
	const coreVersion = getCoreVersion();
	if (semver.lt(semver.coerce(coreVersion), '3.0.0')) {
		return {
			status: NOT_FOUND,
			data: { error: `Action not supported for Lisk Core version: ${coreVersion}.` },
		};
	};

	const response = await CoreService.getEstimateFeeByte();

	const result = { feeEstimatePerByte: {} };
	result.feeEstimatePerByte.low = response.low;
	result.feeEstimatePerByte.medium = response.med;
	result.feeEstimatePerByte.high = response.high;

	const meta = {};
	meta.updated = response.updated;
	meta.blockHeight = response.blockHeight;
	meta.blockId = response.blockId;

	return {
		data: result,
		meta,
	};
};

module.exports = {
	getEstimateFeeByte,
};
