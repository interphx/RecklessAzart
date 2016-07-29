module.exports = {
    schema: 'http',
    domain: 'localhost',
    secret: 'abcd3333fghijklmnohardanalsex',
    steamAPIKey: '4D817705DDA90770247DE0E19BF8D80A',
    rendering: {
        cacheTemplates: false,
        clientOnly: ['roulette', 'chat', 'deposit', 'withdraw']
    },
    roulette: {
        rollTime: 10 * 1000,
        lastRollsRememberCount: 10
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
    },
    deposit: {
        minItemPrice: 0.3   // $USD$
    }
};