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
import api from '../../helpers/api';
import delegates from './constants/delegates';
// import accounts from './constants/accounts';
import config from '../../config';

const baseUrl = config.SERVICE_ENDPOINT;
const baseUrlV1 = `${baseUrl}/api/v1`;
const endpoint = `${baseUrlV1}/delegates`;
// const delegateEndpoint = `${baseUrlV1}/delegate`;

const delegateSchema = {
	address: 'string',
	approval: 'string',
	missedBlocks: 'number',
	producedBlocks: 'number',
	productivity: 'string',
	publicKey: 'string',
	rank: 'number',
	rewards: 'number',
	secondPublicKey: 'string',
	username: 'string',
	vote: 'string',
};

const badRequestSchema = {
	error: 'boolean',
	message: 'string',
};

const notFoundErrorSchema = {
	error: 'boolean',
	message: 'string',
};

const wrongInputParamSchema = {
	error: 'boolean',
	message: 'string',
};

describe('Delegates API', () => {
	describe('GET /delegates', () => {
		it('known delegate by address -> ok', async () => {
			const response = await api.get(`${endpoint}?address=${delegates.activeDelegate.address}`);
			expect(response.data).toBeArrayOfSize(1);
			response.data.map(delegate => expect(delegate).toMapRequiredSchema(delegateSchema));
			expect(response.data[0]).toMapRequiredSchema({
				...delegateSchema,
				address: delegates.activeDelegate.address,
			});
		});

		it('known address by second public key', async () => {
			const url = `${endpoint}?secpubkey=${delegates.activeDelegate.secondPublicKey}`;
			const response = await api.get(url);
			expect(response.data).toBeArrayOfSize(1);
			response.data.map(delegate => expect(delegate).toMapRequiredSchema(delegateSchema));
			expect(response.data[0]).toMapRequiredSchema({
				...delegateSchema,
				secondPublicKey: delegates.activeDelegate.secondPublicKey,
			});
		});

		it('wrong input param -> 400', async () => {
			const response = await api.get(`${endpoint}?id=412875216073141752800000`, 400);
			expect(response).toMapRequiredSchema(wrongInputParamSchema);
		});

		it('search delegates -> ok', async () => {
			const response = await api.get(`${endpoint}?search=genesis`);
			expect(response.data.length).toEqual(10);
		});

		it('invalid address -> 404', async () => {
			const response = await api.get(`${endpoint}?address=412875216073141752800000`, 404);
			expect(response).toMapRequiredSchema(notFoundErrorSchema);
		});
	});

	describe('GET /delegates?publickey', () => {
		it('known delegate by public key -> ok', async () => {
			const response = await api.get(`${endpoint}?publickey=${delegates.activeDelegate.publicKey}`);
			expect(response.data).toBeArrayOfSize(1);
			response.data.map(delegate => expect(delegate).toMapRequiredSchema(delegateSchema));
			expect(response.data[0]).toMapRequiredSchema({
				...delegateSchema,
				publicKey: delegates.activeDelegate.publicKey,
			});
		});

		it('wrong delegate publickey -> 404', async () => {
			const response = await api.get(`${endpoint}?publickey=412875216073141752800000`, 404);
			expect(response).toMapRequiredSchema(notFoundErrorSchema);
		});
	});


	describe('GET /delegates?username', () => {
		it('known delegate by username -> ok', async () => {
			const response = await api.get(`${endpoint}?username=${delegates.activeDelegate.username}`);
			expect(response.data).toBeArrayOfSize(1);
			response.data.map(delegate => expect(delegate).toMapRequiredSchema(delegateSchema));
			expect(response.data[0]).toMapRequiredSchema({
				...delegateSchema,
				username: delegates.activeDelegate.username,
			});
		});

		it('wrong username -> 404', async () => {
			const response = await api.get(`${endpoint}?username=genesis_510000000`, 404);
			expect(response).toMapRequiredSchema(notFoundErrorSchema);
		});
	});

	xdescribe('GET /delegates/latest_registrations', () => {
		it('limit = 100 -> ok', async () => {
			const response = await api.get(`${endpoint}/latest_registrations?limit=100`);
			expect(response.data).toBeArrayOfSize(100);
			response.data.map(delegate => expect(delegate).toMapRequiredSchema(delegateSchema));
		});

		it('limit = 0 -> 400', async () => {
			const response = await api.get(`${endpoint}/latest_registrations?limit=0`, 400);
			expect(response).toMapRequiredSchema(badRequestSchema);
		});

		xit('empty limit -> 400', async () => {
			const response = await api.get(`${endpoint}/latest_registrations?limit=`, 400);
			expect(response).toMapRequiredSchema(badRequestSchema);
		});
	});

	describe('GET /delegates/next_forgers', () => {
		it('limit = 100 -> ok', async () => {
			const response = await api.get(`${endpoint}/next_forgers?limit=100`);
			expect(response.data).toBeArrayOfSize(100);
			response.data.map(delegate => expect(delegate).toMapRequiredSchema(delegateSchema));
		});

		it('limit = 0 -> 400', async () => {
			const response = await api.get(`${endpoint}/next_forgers?limit=0`, 400);
			expect(response).toMapRequiredSchema(badRequestSchema);
		});

		xit('empty limit -> 400', async () => {
			const response = await api.get(`${endpoint}/next_forgers?limit=`, 400);
			expect(response).toMapRequiredSchema(badRequestSchema);
		});
	});

	describe('GET /delegates/active', () => {
		it('default -> ok', async () => {
			const response = await api.get(`${endpoint}?sort=rank:asc&limit=101`);
			expect(response.data).toBeArrayOfSize(101);
			response.data.map(delegate => expect(delegate).toMapRequiredSchema(delegateSchema));
		});

		it('limit = 0 -> 400', async () => {
			const response = await api.get(`${endpoint}?sort=rank:asc&limit=0`, 400);
			expect(response).toMapRequiredSchema(badRequestSchema);
		});

		// Given test fails during CI phase
		it('empty limit -> ok', async () => {
			const response = await api.get(`${endpoint}?sort=rank:asc&limit=`);
			expect(response.data).toBeArrayOfSize(10);
			response.data.map(delegate => expect(delegate).toMapRequiredSchema(delegateSchema));
		});
	});

	describe('GET /delegates/standby', () => {
		it('default -> ok', async () => {
			const response = await api.get(`${endpoint}?sort=rank:asc&offset=101&limit=101`);
			expect(response.data).toBeArrayOfSize(101);
			response.data.map(delegate => expect(delegate).toMapRequiredSchema(delegateSchema));
		});

		it('limit = 100 -> ok', async () => {
			const response = await api.get(`${endpoint}?sort=rank:asc&offset=102&limit=100`);
			expect(response.data).toBeArrayOfSize(100);
			response.data.map(delegate => expect(delegate).toMapRequiredSchema(delegateSchema));
			expect(response.data[0]).toMapRequiredSchema(delegateSchema);
		});

		it('limit = 0 -> 400', async () => {
			const response = await api.get(`${endpoint}?sort=rank:asc&offset=102&limit=0`, 400);
			expect(response).toMapRequiredSchema(badRequestSchema);
		});

		it('empty limit -> ok', async () => {
			const response = await api.get(`${endpoint}?sort=rank:asc&offset=102&limit=`);
			expect(response.data).toBeArrayOfSize(10);
			response.data.map(delegate => expect(delegate).toMapRequiredSchema(delegateSchema));
		});
	});
});
