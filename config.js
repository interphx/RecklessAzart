module.exports = {
    domain: 'localhost',
    secret: 'abcd3333fghijklmnohardanalsex',
    tradeOffers: {
        pollInterval: 10 * 1000,
        cancelTime: 600 * 1000 // Отменяем все офферы старее 10 минут
    },
    overlord: {
        lazyLogin: false
    },
    chat: {
        latestCount: 7
    }
};