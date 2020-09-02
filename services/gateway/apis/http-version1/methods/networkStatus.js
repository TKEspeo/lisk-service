/*
 * LiskHQ/lisk-service
 * Copyright © 2019 Lisk Foundation
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
const networkStatusSource = require('../../../sources/networkStatus');

module.exports = {
	version: '2.0',
	swaggerApiPath: '/network/status',
	rpcMethod: 'get.network.status',
	tags: ['Network'],
	get schema() {
		const networkSchema = {};
		networkSchema[this.swaggerApiPath] = { get: {} };
		networkSchema[this.swaggerApiPath].get.tags = this.tags;
		networkSchema[this.swaggerApiPath].get.responses = {
			200: {
				description: 'array of peers',
				schema: {
					type: 'array',
					items: {
						$ref: '#/definitions/NetworkStatistics',
					},
				},
			},
			400: {
				description: 'bad input parameter',
			},
			404: {
				description: 'Not found',
			},
		};
		return networkSchema;
	},
	source: networkStatusSource,
};
