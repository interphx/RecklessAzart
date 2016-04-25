module.exports = {
    domain: 'localhost',
    secret: 'abcd3333fghijklmnohardanalsex',
    rendering: {
        cacheTemplates: false
    },
    tradeOffers: {
        pollInterval: 10 * 1000,
        cancelTime: 600 * 1000 // Отменяем все офферы старее 10 минут
    },
    overlord: {
        lazyLogin: true
    },
    chat: {
        latestCount: 7
    }
};