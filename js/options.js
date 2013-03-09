/*jslint plusplus: true, passfail: true, browser: true, devel: true, indent: 4, maxlen: 100 */
/*global chrome*/
(function () {
	'use strict';

	function restore_options() {
		var inputs = document.getElementsByClassName('option'),
			value,
			def,
			i;

		for (i = 0; i < inputs.length; i++) {
			value = localStorage['ttw_' + inputs[i].id];
			if (inputs[i].id === "top") {
				def = 0;
			} else {
				def = 50;
			}

			if (typeof value === "undefined") {
				inputs[i].value = def;
			} else {
				inputs[i].value = value;
			}
		}
	}

	function save_options(event) {
		var inputs = document.getElementsByClassName('option'),
			submit = document.getElementById('sub'),
			valid = true,
			i;

		// Save to Local Storage
		for (i = 0; i < inputs.length; i++) {
			if (inputs[i].checkValidity()) {
				localStorage['ttw_' + inputs[i].id] = inputs[i].valueAsNumber;
			} else {
				valid = false;
			}
		}

		if (valid) {
			event.preventDefault();
			// Update Status
			submit.value = 'Saved';
			submit.style.opacity = '0.5';
			setTimeout(function () {
				submit.value = 'Save';
				submit.style.opacity = '1';
			}, 1000);
		}
	}

	function make_oninput_handler() {
		return function (event) {
			var input = event.target,
				val = Number(input.value),
				max = Number(input.max),
				min = Number(input.min);

			input.checkValidity();
		};
	}

	function make_oninvalid_handler() {
		var submit = document.getElementById('sub');

		return function (event) {
			var input = event.target,
				val = Number(input.value),
				max = Number(input.max),
				min = Number(input.min);

			submit.click();
		};
	}

	function add_handlers() {
		var inputs = document.getElementsByClassName('option'),
			i;

		for (i = 0; i < inputs.length; i++) {
			inputs[i].oninput = make_oninput_handler();
			inputs[i].oninvalid = make_oninvalid_handler();
		}
	}

	function resize_screen() {
		var userScreen = document.getElementById('screen'),
			width = userScreen.clientWidth,
			ratio = screen.height / screen.width,
			borderWidth = Math.ceil(width * 0.01, 10);

		userScreen.style.height = (width * ratio) + "px";
		userScreen.style.width = (width - (borderWidth * 2)) + "px";
		userScreen.style.borderTopWidth = borderWidth + "px";
		userScreen.style.borderLeftWidth = borderWidth + "px";
		userScreen.style.borderRightWidth = borderWidth + "px";
	}


	function init() {
		resize_screen();
		restore_options();
		add_handlers();
	}

	document.addEventListener('DOMContentLoaded', init);
	document.querySelector('#sub').addEventListener('click', save_options);
	document.getElementById('extensions').addEventListener('click', function () {
		chrome.tabs.update({
			url: 'chrome://extensions/'
		});
	});
}());