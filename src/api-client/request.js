const axios = require('axios');
const https = require('https');

const { version } = require('../../package.json');

const { API_CONSTANTS, API_CONFIG } = require('./api_const');

// TODO implement work with web-forms

const agent = new https.Agent({
    rejectUnauthorized: false
});

function initApi(apiKey, url = API_CONSTANTS.URL, ignoreSsl = false) {
    API_CONFIG.HEADERS = { [API_CONSTANTS.HEADER_API_KEY]: apiKey };
    API_CONFIG.IGNORE_SSL = ignoreSsl;
    API_CONFIG.BASE = process.env['API_URL'] || url;
    API_CONSTANTS.API_KEY = apiKey;
}

function isDefined(value) {
    return value !== undefined && value !== null;
}

function isString(value) {
    return typeof value === 'string';
}

function isStringWithValue(value) {
    return isString(value) && value !== '';
}

function isSuccess(status) {
    return status >= 200 && status < 300;
}

function base64(str) {
    try {
        return btoa(str);
    } catch (err) {
        return Buffer.from(str).toString('base64');
    }
}

function getQueryString(params) {
    const qs = [];

    const append = (key, value) => {
        qs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }

    Object.entries(params)
        .filter(([_, value]) => isDefined(value))
        .forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach((v) => append(key, v));
            } else {
                append(key, value);
            }
        });

    if (qs.length > 0) {
        return `?${qs.join('&')}`;
    }

    return '';
}

function getUrl(options) {
    const path = options.path;
    const url = `${API_CONFIG.BASE}${path}`;
    if (options.query) {
        return `${url}${getQueryString(options.query)}`;
    }

    return url;
}

async function resolve(options, func) {
    if (typeof func === 'function') {
        return func(options);
    }
    return func;
}

async function getHeaders(options) {
    const token = await resolve(options, API_CONFIG.TOKEN);
    const username = await resolve(options, API_CONFIG.USERNAME);
    const password = await resolve(options, API_CONFIG.PASSWORD);
    const additionalHeaders = await resolve(options, API_CONFIG.HEADERS);

    const headers = Object.entries({
        Accept: 'application/json',
        'User-Agent': `ABW_SDK_JS/${version}`,
        ...additionalHeaders,
        ...options.headers,
    })
        .filter(([_, value]) => isDefined(value))
        .reduce(
            (headers, [key, value]) => ({
                ...headers,
                [key]: String(value),
            }),
            {},
        );

    if (isStringWithValue(token)) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (isStringWithValue(username) && isStringWithValue(password)) {
        const credentials = base64(`${username}:${password}`);
        headers['Authorization'] = `Basic ${credentials}`;
    }

    return headers;
}

function getRequestBody(options) {
    if (options.body) {
        return options.body;
    }
}

async function sendRequest(options, url, body, headers) {
    let config = {
        url,
        headers,
        data: body,
        method: options.method,
        withCredentials: API_CONFIG.WITH_CREDENTIALS,
    };

    if (API_CONFIG.IGNORE_SSL) {
        config.httpsAgent = agent;
    }

    try {
        return await axios.request(config);
    } catch (error) {
        const axiosError = error;
        if (axiosError.response) {
            return axiosError.response;
        }
        throw error;
    }
}

function getResponseHeader(response, responseHeader) {
    if (responseHeader) {
        const content = response.headers[responseHeader];
        if (isString(content)) {
            return content;
        }
    }
}

function getResponseBody(response) {
    if (response.status !== 204) {
        return response.data;
    }
}

function catchErrors(options, result) {
    const errors = {
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        406: 'No param',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        ...options.errors,
    }

    const error = errors[result.status];
    if (error) {
        throw new Error(error);
    }

    if (!result.ok) {
        throw new Error('Generic Error');
    }
}

function apiRequest(options) {
    return new Promise(async (resolve, reject) => {
        try {
            const url = getUrl(options);
            const body = getRequestBody(options);
            const headers = await getHeaders(options);

            const response = await sendRequest(options, url, body, headers);
            const responseBody = getResponseBody(response);
            const responseHeader = getResponseHeader(response, options.responseHeader);
            const result=  {
                url,
                ok: isSuccess(response.status),
                status: response.status,
                statusText: response.statusText,
                body: responseHeader || responseBody,
            };

            catchErrors(options, result);
            resolve(result.body);
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    initApi,
    apiRequest
}