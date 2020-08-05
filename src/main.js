import _ from 'lodash';
import $ from 'jquery';

$(document).on('mousewheel DOMMouseScroll', onMouseScroll);

function onMouseScroll(e) {
	e.preventDefault();
	var wheel = e.originalEvent.wheelDelta || -e.originalEvent.detail;
	var delta = Math.max(-1, Math.min(1, wheel));
	if (delta < 0) {//向下滚动
		console.log('向下滚动');
	} else {//向上滚动
		console.log('向上滚动');
	}
}
