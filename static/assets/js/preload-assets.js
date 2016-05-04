$(document).ready(function() {
    var loaded = [];
    
    function preloadImage(url) {
        var img = new Image();
        img.src = url;
        loaded.push(img);
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
    
});