(function(container){
	function toggle(add) {
		return add ? 'addClass' : 'removeClass';
	}
	
	$(container).on('input change', '[data-clearable]', function() {
		var $this = $(this);
		$this[toggle(this.value !== $this.attr('data-clearable'))]('clearable-x');
	}).on('mousemove', '.clearable-x', function(e) {
		var paddingRight = parseInt($(this).css('padding-right')) || 18;
		$(this)[toggle(this.offsetWidth - paddingRight < e.clientX - this.getBoundingClientRect().left)]('clearable-hover-x');
	}).on('touchstart click', '.clearable-hover-x', function(e){
		e.preventDefault();
		var $this = $(this);
		$this.removeClass('clearable-x clearable-hover-x').val($this.attr('data-clearable')).change();
	});
})(document);