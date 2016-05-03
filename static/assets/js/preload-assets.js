(function() {
    function preloadImage(url) {
        (new Image()).src = url;
    }
    
    function preloadAll(resources) {
        for (var i = 0; i < resources.length; ++i) {
            preloadImage(resources[i]);
        }
    }
    
    preloadAll([
        '/assets/img/cross16x16.png',
        '/assets/img/cross_highlighted16x16.png'
    ]);
    
})();