var IntervalMap = (function(){
	function IntervalMap(intervals) {
		this.intervals = intervals;
	}
	
	IntervalMap.prototype = {
		constructor: IntervalMap,
		get: function(number) {
			for (var i = 0; i < this.intervals.length; ++i) {
				var interval = this.intervals[i][0];
				if (interval[0] <= number && interval[1] >= number) return this.intervals[i][1];
			}
		}
	};
	
	return IntervalMap;
})();