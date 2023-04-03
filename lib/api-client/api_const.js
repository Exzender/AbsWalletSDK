const API_BASE_PATH = process.env.API_BASE_PATH ||  'https://localhost:8081';

const API_CONSTANTS = {
    URL: API_BASE_PATH,
    HEADER_API_KEY: 'X-API-KEY',
    NODE_TYPE_KEY: 'x-node-type',
    API_VERSION: 'v1',
    API_KEY: '',
    TRON_PRO_API_KEY: '',
}

const API_CONFIG = {
    BASE: API_BASE_PATH,
    VERSION: '2.0.0',
    WITH_CREDENTIALS: false,
    CREDENTIALS: 'include',
    TOKEN: undefined,
    USERNAME: undefined,
    PASSWORD: undefined,
    HEADERS: undefined,
    ENCODE_PATH: undefined,
    IGNORE_SSL: undefined
};

module.exports = {
    API_CONSTANTS,
    API_CONFIG
}