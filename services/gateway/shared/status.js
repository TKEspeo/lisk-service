/*
 * LiskHQ/lisk-service
 * Copyright © 2019-2020 Lisk Foundation
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
const packageJson = require('../package.json');

const getBuildTimestamp = () => {
	let timestamp;
	try {
		// eslint-disable-next-line import/no-unresolved
		timestamp = require('../build.json').timestamp;
	} catch (e) {
		//  build.json is only generated in docker
	}
	if (!timestamp) {
		timestamp = new Date().toISOString();
	}
	return timestamp;
};

const buildTimestamp = getBuildTimestamp();

const getStatus = () => ({
	build: buildTimestamp,
    description: 'Lisk Service Gateway',
    name: packageJson.name,
	version: packageJson.version,
	network: {
		networkId: 'unknown',
		protocolVersion: 'unknown',
	},
});

const getReady = () => ({
	services: {
		lisk_blocks: true,
		lisk_peers: true,
		lisk_transations: true,
		lisk_transation_statistics: true,
		lisk_accounts: true,
		lisk_delegates: true,
	},
});

module.exports = {
	getReady,
	getStatus,
};