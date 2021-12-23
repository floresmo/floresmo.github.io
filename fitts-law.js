"use strict";

/**
 * Create dimensions from the given values and store them for later use.
 * All values should be positive and make sense.
 * @param {number} width The outer width of the area.
 * @param {number} height The outer height of the area.
 * @param {number} top Margin form the top edge.
 * @param {number} right Margin form the right edge.
 * @param {number} bottom Margin form the bottom edge.
 * @param {number} left Margin form the left edge.
 */
function makeDimension(width, height, top, right, bottom, left) {
	return {width: width,
		height: height,
		innerWidth: width - (left + right),
		innerHeight: height - (top + bottom),
		top: top,
		right: right,
		bottom: bottom,
		left: left,
		cx: (width - (left + right)) / 2 + left,
		cy: (height - (top + bottom)) / 2 + top};
}

// set up dimensions for the plotting.
var testDimension = makeDimension(900, 650, 30, 30, 30, 30);
var plotPositionDimension = makeDimension(220, 200, 30, 30, 30, 30);
var plotVelocitiesDimension = plotPositionDimension;
var plotHitsDimension = plotPositionDimension;
var plotScatterDimension = makeDimension(220, 200, 30, 30, 30, 50);
var scatterEffectiveDimension = makeDimension(540, 300, 30, 30, 30, 50);
var positionEffectiveDimension = makeDimension(540, 200, 30, 30, 30, 40);
var speedEffectiveDimension = positionEffectiveDimension;
var histDimension = makeDimension(540, 300, 30, 30, 30, 50);

var LIVE_STAY = 1000;
var MAX_TIME = 6000;
var UPDATE_DELAY = MAX_TIME;
var MAX_SPEED = 6; // pixel/ms

var INSTRUCTION_MOUSE = "Take your mouse!"
var INSTRUCTION_GAMEPAD = "Take your gamepad!"

function rHit(r, rTarget) {
	return ((plotHitsDimension.innerWidth / 2) / rTarget) * r;
};



function v(v) {
	var colour = 'rgb(' + clampInt(0, 255, (v / MAX_SPEED) * 255) + ', 0, 0)';
	return colour;
};

var scatterX = d3.scale.linear()
	.domain([0.5, 5.5])
	.range([0, plotScatterDimension.innerWidth]);

var scatterY = d3.scale.linear()
	.domain([MAX_TIME, 0])
	.range([0, plotScatterDimension.innerHeight]);

var scaleT = d3.scale.linear()
	.domain([0, 1000])
	.range([0, plotVelocitiesDimension.innerWidth]);

var scaleV = d3.scale.linear()
	.domain([0, MAX_SPEED])
	.range([plotVelocitiesDimension.innerHeight, 0]);

var scaleX = d3.scale.linear()
	.domain([-20, 300])
	.range([0, plotPositionDimension.innerWidth]);

var scaleY = d3.scale.linear()
	.domain([-50, 50])
	.range([plotPositionDimension.innerHeight, 0]);

var effScatterX = d3.scale.linear()
	.domain([0.5, 6.5])
	.range([0, scatterEffectiveDimension.innerWidth]);

var effScatterY = d3.scale.linear()
	.domain([MAX_TIME, 0])
	.range([0, scatterEffectiveDimension.innerHeight]);

var effPositionX = d3.scale.linear()
	.domain([-60, 400])
	.range([0, positionEffectiveDimension.innerWidth]);

var effPositionY = d3.scale.linear()
	.domain([-50, 50])
	.range([positionEffectiveDimension.innerHeight, 0]);
	
var effSpeedX = d3.scale.linear()
	.domain([0, MAX_TIME])
	.range([0, speedEffectiveDimension.innerWidth])

var effSpeedY = d3.scale.linear()
	.domain([0, MAX_SPEED])
	.range([speedEffectiveDimension.innerHeight, 0]);


function linearRegression(y,x){

	var lr = {};
	var n = y.length;
	var sum_x = 0;
	var sum_y = 0;
	var sum_xy = 0;
	var sum_xx = 0;
	var sum_yy = 0;

	for (var i = 0; i < y.length; i++) {

		sum_x += x[i];
		sum_y += y[i];
		sum_xy += (x[i]*y[i]);
		sum_xx += (x[i]*x[i]);
		sum_yy += (y[i]*y[i]);
	} 

	lr['slope'] = (n * sum_xy - sum_x * sum_y) / (n*sum_xx - sum_x * sum_x);
	lr['intercept'] = (sum_y - lr.slope * sum_x)/n;
	lr['r2'] = Math.pow((n*sum_xy - sum_x*sum_y)/Math.sqrt((n*sum_xx-sum_x*sum_x)*(n*sum_yy-sum_y*sum_y)),2);

	return lr;

};

function downloadCsv(csvContent,file_name) {
	// download data file
	var encodedUri = encodeURI(csvContent);
	var link = document.createElement("a");
	link.setAttribute("href", encodedUri);
	link.setAttribute("download", file_name);
	document.body.appendChild(link); // Required for FF
	link.click();
}

function filterOutliers (someArray) {
	fittsTest.IDs.forEach((id) => {
		let time_values = someArray.filter(obj => obj.id == id).map(obj => obj.time)

		if (time_values.length >= 4) {
			let sorted_time_values = time_values.slice().sort((a, b) => a - b); // copy array fast and sort
			let q1 = getQuantile(sorted_time_values, 25);
			let q3 = getQuantile(sorted_time_values, 75);

			let iqr, maxValue, minValue;
			iqr = q3 - q1;
			maxValue = q3 + iqr * 1.5;
			minValue = q1 - iqr * 1.5;
			someArray = someArray.filter(obj => obj.id != id || (obj.time >= minValue && obj.time <= maxValue ));
		}
	});
	return someArray;
}

function getQuantile (array, quantile) {
    // Get the index the quantile is at.
    let index = quantile / 100.0 * (array.length - 1);

    // Check if it has decimal places.
    if (index % 1 === 0) {
        return array[index];
    } else {
        // Get the lower index.
        let lowerIndex = Math.floor(index);
        // Get the remaining.
        let remainder = index - lowerIndex;
        // Add the remaining to the lowerindex value.
        return array[lowerIndex] + remainder * (array[lowerIndex + 1] - array[lowerIndex]);
    }
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

var fittsTest = {
	target: {x: 0, y: 0, r: 10},
	start: {x: 0, y: 0, t: 0},
	last: {},

	isoPositions: [],
	currentPosition: 0,
	currentCount: 0,
	miss: 0,
	isoLimits: {minD: 120, maxD: 300, minW:10 , maxW: 100, minC: 0, maxC:100},
	isoParams: {num: 9, distance: 500, width: 50, randomize: true, cursorDiameter: 0},
	
	currentPath: [],
	active: false,
	
	data: [],
	currentDataSet: 0,
	dataCnt: 0,
	
	colour: d3.scale.category10(),
	
	sumID: 0,
	sumTime: 0,
	
	updateTimeoutHandle: undefined,

	// experiment parameters
	gamepadMode: false,
	gamepadSensibility: 20,
	mouseData: [],
	gamepadData: [],
	gamepadCursorData: [],
	IDs: [1.5, 2, 2.5, 3, 3.5, 4, 4.5],
	IDsArrayIndex:0,
	training:true,
	experimentStep: 0,
	experimentStartWithGamepad:false,

	downloadResult: function() {
		let csvContent;
		let titles = ['ID','time','experiment'];

		// mouse
		// this.mouseData = removeMinMaxByID(this.mouseData)
		csvContent = "data:text/csv;charset=utf-8," + titles.join(",") + "\r\n" + this.mouseData.map(obj => obj.id + ',' + obj.time + ',mouse').join("\n");
		downloadCsv(csvContent,'data_mouse.csv')

		// gamepad
		// this.gamepadData = removeMinMaxByID(this.gamepadData)
		csvContent = "data:text/csv;charset=utf-8," + titles.join(",") + "\r\n" + this.gamepadData.map(obj => obj.id + ',' + obj.time + ',gamepad').join("\n");
		downloadCsv(csvContent,'data_gamepad.csv')

		// gamepad cursor
		// this.gamepadCursorData = removeMinMaxByID(this.gamepadCursorData)
		csvContent = "data:text/csv;charset=utf-8," + titles.join(",") + "\r\n" + this.gamepadCursorData.map(obj => obj.id + ',' + obj.time + ',gamepad_cursor').join("\n");
		downloadCsv(csvContent,'data_gamepad_cursor.csv')

		// gamepad cursor diameter
		const ids = this.gamepadCursorData.map(obj => obj.id);
		csvContent = "data:text/csv;charset=utf-8," + ['ID','cursor_diameter'].join(",") + "\r\n" + this.gamepadCursorData.filter(({id},index) => !ids.includes(id, index + 1)).map(obj => obj.id + ',' + obj.cursor_diameter).join("\n");
		downloadCsv(csvContent,'data_gamepad_cursor_diameter.csv')
	},

	reinitExperiment: async function(instruction) {
		this.training = false
		this.mouseData = []
		this.gamepadData = []
		this.gamepadCursorData = []
		$('#device_modes').hide()
		disconnectGamepad()
		this.removeTarget()

		this.IDsArrayIndex = 0
		this.experimentStep = 0
		shuffle(this.IDs)
		$('#experiment_trial_label').text(this.IDsArrayIndex+1)
		$('#experiment_trial_title').show()
		await fittsTest.launchTimer(instruction)
		this.randomizeParams();
		this.currentCount = 0;
		this.currentPosition = 0;
		this.miss = 0;
		this.updateISOCircles();
		this.generateTarget();
		this.active = false;
	},

	switchToTraining: function() {
		this.training = true
		this.mouseData = []
		this.gamepadData = []
		this.gamepadCursorData = []
		$('#experiment_trial_title').hide()
		$('#device_modes').show()
		this.gamepadMode = false
		$("#mouse_mode_radio").click();
		disconnectGamepad()
		console.log('Training mode')
	},

	getAreaCursor: function() {
		// pour l'ID courant
		const currentID = this.IDs[this.IDsArrayIndex];
		// calcul du temps souris
		// this.mouseData = removeMinMaxByID(this.mouseData)
		var lr_mouse = linearRegression(this.mouseData.map(obj => obj.time),this.mouseData.map(obj => obj.id));
			// now you have:
			// lr.slope
			// lr.intercept
			// lr.r2


		var mouse_time = lr_mouse.intercept + lr_mouse.slope * currentID

		// en déduire l'ID associé à ce temps pour le gamepad
		// this.gamepadData = removeMinMaxByID(this.gamepadData)
		var lr_gamepad = linearRegression(this.gamepadData.map(obj => obj.time),this.gamepadData.map(obj => obj.id));

		var ID_gamepad = (mouse_time - lr_gamepad.intercept) / lr_gamepad.slope;

		// en déduire la taille de la cible associé
		var target_size = this.isoParams.distance/(2**(currentID) - 1);

		// en déduire la correction
		var area_cursor_diameter = (this.isoParams.distance/(2**(ID_gamepad) - 1)) - target_size;

		console.log(lr_mouse)
		console.log(lr_gamepad)
		
		return area_cursor_diameter > 0 ? (area_cursor_diameter > this.isoParams.distance ? this.isoParams.distance : area_cursor_diameter) : 0;
	},
	
	generateTarget: function() {
		this.target = this.isoPositions[this.currentPosition];
		this.target.distance = this.isoParams.distance;
		this.currentPosition = (this.currentPosition + Math.ceil(this.isoPositions.length/2)) % this.isoPositions.length;
		
		var target = testAreaSVG.selectAll('#target').data([this.target]);
		
		var insert = function(d) {
			d.attr('cx', function(d) { return d.x; })
			.attr('cy', function(d) { return d.y; })
			.attr('r', function(d) { return d.w / 2; });
		}

		target.enter()
			.append('circle')
				.attr('id', 'target')
				.style('fill', 'red')
				.call(insert);
									
		target.transition()
				.call(insert);

		this.drawAreaCursor(this.last);
		this.colorTarget(this.last.x,this.last.y);
		
		this.active = true;
	},
	
	updateISOCircles: function() {
		this.currentCount = 0;
		
		this.generateISOPositions(this.isoParams.num,
			this.isoParams.distance,
			this.isoParams.width);

		var circles = testAreaSVG.selectAll('circle').data(this.isoPositions);
		
		/*var insert = function(d) {
			d.attr('cx', function(d) { return d.x; })
			.attr('cy', function(d) { return d.y; })
			.attr('r', function(d) { return d.w / 2; });
		}*/

		/*circles.enter()
			.append('circle')
				.attr('class', 'iso')
				.call(insert);
									
		circles.transition()
			.call(insert);*/
		
		circles.exit()
			.transition()
				.attr('r', 0)
				.remove();
		
		// this.currentPosition = 0;
		this.generateTarget();
		this.active = false;
},
	
	generateISOPositions: function(num, d, w) {
		
		// remove all data from live view
		plotHitsGroup.selectAll('circle.hit')
			.transition()
				.duration(LIVE_STAY)
					.ease('linear')
					.attr('r', 2)
					.style('opacity', 0)
					.remove();
		
		plotPositionGroup.selectAll('line.live')
			.transition()
				.duration(LIVE_STAY)
				.style('stroke-opacity', 0)
				.remove();

		plotVelocitiesGroup.selectAll('line.live')
			.transition()
				.duration(LIVE_STAY)
				.style('stroke-opacity', 0)
				.remove();
		
		
		this.isoPositions = [];
		
		for (var i = 0; i < num; i++) {
			this.isoPositions[i] = {x: testDimension.cx + ((d/2) * Math.cos((2 * Math.PI * i) / num)),
				y: testDimension.cy + ((d/2) * Math.sin((2 * Math.PI * i) / num)),
				w: w};
		}
	},
	
	removeTarget: function() {
		testAreaSVG.selectAll('#target').data([])
			.exit()
				.remove();
				
		this.active = false;
		this.currentPath = [];
	},

	launchTimer: async function(instruction) {
		let seconds = 10;
		const timerElement = document.getElementById("timer")
		const instructionElement = document.getElementById("experiment_instruction")
		$("#app_modes *").attr( "disabled", true );
		$("#device_modes *").attr( "disabled", true );
		timerElement.innerText = `${seconds}`;
		instructionElement.innerText = instruction;
		var interval = setInterval(function() {
			timerElement.innerText = `${seconds}`;
			seconds = seconds - 1;
			if(seconds < 0) {
				clearInterval(interval);
				timerElement.innerText = "";
				instructionElement.innerText = "";
				$("#app_modes *").attr( "disabled", false );
				$("#device_modes *").attr( "disabled", false );
			}
		}, 1000)
		return await sleep((seconds+1)*1000);
	},
	
	mouseClicked: async function(x, y) {
		disconnectGamepad()
		if (distance({x: x, y: y}, this.target) - (this.isoParams.cursorDiameter / 2) < (this.target.w / 2)) {

			var data = {
				start: this.start,
				target: this.target,
				path: this.currentPath,
				hit: {x: x, y: y, t: (new Date).getTime()}
			}
			this.addDataPoint(data);
			this.removeTarget();

			if(!this.training) {
				// store experiment data: time - distance - width - cursor size
				var dt = data.hit.t - data.start.t;
				if (dt < MAX_TIME)  // skip if obvious outlier
				{
					var dist = distance(data.target, data.start);

					if(!this.gamepadMode && (this.experimentStep == 0 || this.experimentStep == 1)) {
						this.mouseData.push({time: dt, distance: dist, width: data.target.w, id: this.IDs[this.IDsArrayIndex > 0 ? this.IDsArrayIndex - 1 : this.IDs.length-1]})
					}
					else if(this.experimentStep == 0 || this.experimentStep == 1) {
						this.gamepadData.push({time: dt, distance: dist, width: data.target.w, id: this.IDs[this.IDsArrayIndex > 0 ? this.IDsArrayIndex - 1 : this.IDs.length-1]})
					}
					else {
						// to do area cursor
						this.gamepadCursorData.push({time: dt, distance: dist, width: data.target.w, cursor_diameter: this.isoParams.cursorDiameter, id: this.IDs[this.IDsArrayIndex > 0 ? this.IDsArrayIndex - 1 : this.IDs.length-1]})
					}
				}
			}

			// to modify : si on veut changer les paramètres mais sans random
			if (this.isoParams.randomize && this.currentCount >= this.isoPositions.length) {

				if(!this.training && fittsTest.IDsArrayIndex == 0) {
					var instruction = ""
					if(this.experimentStep == 0 || this.experimentStep == 1) {
						if(!this.gamepadMode) {
							this.mouseData = filterOutliers(this.mouseData);
							console.log(this.mouseData)
							instruction = INSTRUCTION_GAMEPAD
							this.gamepadMode = true
							positionCursor();
						}
						else {
							this.gamepadData = filterOutliers(this.gamepadData);
							console.log(this.gamepadData)
							if(this.experimentStep == 0) {
								instruction = INSTRUCTION_MOUSE
								this.gamepadMode = false
							}
							else {
								instruction = INSTRUCTION_GAMEPAD
								positionCursor();
							}
						}
						$('#experiment_trial_label').text(fittsTest.IDsArrayIndex+1)
						await this.launchTimer(instruction);
					}
					else {
						this.gamepadCursorData = filterOutliers(this.gamepadCursorData);
						console.log(this.gamepadCursorData)
						this.isoParams.cursorDiameter = 0;
					}
					this.experimentStep = (this.experimentStep + 1) % 3;
					if(this.experimentStep == 0) {
						this.downloadResult()
						this.gamepadData = []
						this.mouseData = []
						this.gamepadCursorData = []
						$("#training_mode_radio").click();
					}
				}
				$('#experiment_trial_label').text(fittsTest.IDsArrayIndex+1)

				this.randomizeParams();
				this.currentCount = 0;
				// this.currentPosition = 0;
				this.miss = 0;
				// this.updateISOCircles();
				// this.generateTarget();
				this.gamepadSensibility = 20;
				this.active = false;
			}
			else {
				this.currentCount++;
				this.generateTarget();			
			}

			
			this.last = {x: x, y: y, t: (new Date).getTime()};
			this.start = this.last;
			this.currentPath.push(this.last);
		}
		else {
			this.miss++;
		}
		if(this.gamepadMode) {
			connectGamepad();
		}
	},

	drawAreaCursor : function(newPoint) {
		testAreaSVG.select('#cursor-area').remove();

		testAreaSVG.append('circle')
			.attr('id', 'cursor-area')
			.attr('r', this.isoParams.cursorDiameter/2)
			.attr('cx', newPoint.x)
			.attr('cy', newPoint.y);
	},

	colorTarget: function(x,y) {
		var target = testAreaSVG.select('#target');
		if (this.gamepadMode && (this.training || (this.experimentStep == 0 || this.experimentStep == 1))){
				
			if (distance({x: x-8, y: y-8}, this.target) < (this.target.w / 2)) {	
				target.style('fill', 'green');
			}
			else {
				target.style('fill', 'red');
			}
		}else{
			if (distance({x: x, y: y}, this.target) - (this.isoParams.cursorDiameter / 2) < (this.target.w / 2)) {	
				target.style('fill', 'green');
			}
			else {
				target.style('fill', 'red');
			}
		}
	},
	
	mouseMoved: function(x, y) {
		//if (this.active) {
			// skip if the mouse did actually not move
			// that should practically never happen...
			if (x == this.last.x && y == this.last.y) {
				return;
			}
			
			// set timeout for updating plots
			/*if (this.updateTimeoutHandle) {
				window.clearTimeout(this.updateTimeoutHandle);
			}
			this.updateTimeoutHandle = window.setTimeout(this.updatePlots, UPDATE_DELAY, this);*/
			
			
			var newPoint = {x: x, y: y, t: (new Date).getTime()}
			this.currentPath.push(newPoint)
			
			var dt = newPoint.t - this.last.t;
			var dist = distance(this.last, {x: x, y: y})
			if (dt > 0)
				var speed = dist / dt;
			else
				var speed = 0;
			
			/*testAreaSVG.append('line')
				// .attr('class', '')
				.attr('x1', this.last.x)
				.attr('x2', newPoint.x)
				.attr('y1', this.last.y)
				.attr('y2', newPoint.y)
				.style('stroke', v(speed))
				.transition()
					.duration(5000)
					.style('stroke-opacity', 0)
					.remove();*/

			/*testAreaSVG.select('#cursor-area').remove();

			testAreaSVG.append('circle')
				.attr('id', 'cursor-area')
				.attr('r', this.isoParams.cursorDiameter/2)
				.attr('cx', newPoint.x)
				.attr('cy', newPoint.y);*/
			this.drawAreaCursor(newPoint);		
				
			this.last = newPoint;

			// change target color when you can click on it
			this.colorTarget(x,y);
			/*var target = testAreaSVG.select('#target');

			if (this.gamepadMode && (this.training || (this.experimentStep == 0 || this.experimentStep == 1))){
				
				if (distance({x: x-8, y: y-8}, this.target) < (this.target.w / 2)) {	
					target.style('fill', 'green');
				}
				else {
					target.style('fill', 'red');
				}
			}else{
				if (distance({x: x, y: y}, this.target) - (this.isoParams.cursorDiameter / 2) < (this.target.w / 2)) {	
					target.style('fill', 'green');
				}
				else {
					target.style('fill', 'red');
				}
			}*/

			// DONE :  decrease sensibility if close to the target 
			if (this.gamepadMode && (this.training || (this.experimentStep == 0 || this.experimentStep == 1))){
				if (distance({x: x, y: y}, this.target) - (this.isoParams.cursorDiameter / 2) < (this.target.w+100 / 2)) {	
					this.gamepadSensibility = 10;
				}
				else {
					this.gamepadSensibility = 20;
				}
			}

		//}
	},
	
	addDataPoint: function(data) {
		// add point to data array for plotting into ID/time scatter plot
		if (this.active == false)
			return;

		var dt = data.hit.t - data.start.t;
	
		if (dt < MAX_TIME)  // skip if obvious outlier
		{
			var dist = distance(data.target, data.start);
			var id = fitts(dist, data.target.w);

			this.data[this.currentDataSet].data.push({time: dt, distance: data.target.distance, width: data.target.w, hit: data.hit,
				start: data.start, target: data.target, path: data.path});

			scatterGroup.append('circle')
				.attr('class', 'cat' + this.currentDataSet)
				.style('fill', this.data[this.currentDataSet].colour)
				.attr('cx', scatterX(id))
				.attr('cy', scatterY(dt))
				.attr('r', 0)
					.transition()
						.duration(200)
						.ease('bounce')
						.attr('r', 3);		
		
			var A = data.start;
			var B = data.target;
			var path = data.path;
		
			var hit = {}
			var q = project(A, B, data.hit);
			hit.x = distance(q, B) * sign(q.t - 1);
			hit.y = distance(q, data.hit) * isLeft(A, B, data.hit);
		
		
			plotHitsGroup.append('circle')
				.attr('class', 'hit')
				.attr('cx', rHit(hit.x, data.target.w / 2))
				.attr('cy', rHit(hit.y, data.target.w / 2))
				.attr('r', 6)
				.style('fill', 'red')
				.style('opacity', 1)
				.transition()
					.duration(500)
						.ease('linear')
						.attr('r', 3);
		
			var last = { x: 0, y: 0, t: data.start.t, v: 0};
			for (var i = 0; i < path.length; i++) {
				var p = path[i];
			
				var q = project(A, B, p);
				var x = distance(q, A) * sign(q.t);
				var y = distance(q, p) * isLeft(A, B, p);

				var dt = p.t - last.t;
				var dist = distance(last, {x: x, y: y});
				if (dt > 0)
					var speed = dist / dt;
				else
					var speed = 0;
		
				plotPositionGroup.append('svg:line')
					.attr('class', 'live')
					.attr('x1', scaleX(last.x))
					.attr('x2', scaleX(x))
					.attr('y1', scaleY(last.y))
					.attr('y2', scaleY(y))
					.style('stroke', v(speed))
					.transition()
						.duration(LIVE_STAY)
						.style('stroke-opacity', 0.5);
			
				plotVelocitiesGroup.append('svg:line')
					.attr('class', 'live')
					.attr('x1', scaleT(last.t - data.start.t))
					.attr('x2', scaleT(p.t - data.start.t))
					.attr('y1', scaleV(last.v))
					.attr('y2', scaleV(speed))

					.style('stroke', v(speed))
					.transition()
						.duration(LIVE_STAY)
						.style('stroke-opacity', 0.5);
					
				var last = {}
				last.x = x;
				last.y = y;
				last.t = p.t;
				last.v = speed;
			}
		}
	},
	
	randomizeParams: function() {
		// this.isoParams.distance = Math.floor(randomAB(this.isoLimits.minD, this.isoLimits.maxD));
		// this.isoParams.width = Math.floor(randomAB(this.isoLimits.minW, this.isoLimits.maxW));

		// random ID ?
		// un tableau d'ID que l'on mixe
		// then compute the distance ?

		if(!this.training && this.experimentStep == 2) {
			this.isoParams.cursorDiameter = this.getAreaCursor()
		}

		var currentID = this.IDs[this.IDsArrayIndex];
		this.IDsArrayIndex = (this.IDsArrayIndex + 1) % this.IDs.length;

		this.isoParams.width = invertedFitts(this.isoParams.distance,currentID);
		console.log('ID',currentID)

		/*if(this.gamepadMode) {
			this.isoParams.cursorDiameter = Math.floor(randomAB(this.isoLimits.minC, this.isoLimits.maxC));
		}
		else {
			this.isoParams.cursorDiameter = 0;
		}*/
		

		$('#sliderDistance').slider('value', this.isoParams.distance);
		$('#sliderWidth').slider('value', this.isoParams.width);
		$('#sliderCursor').slider('value', this.isoParams.cursorDiameter);

		this.updateISOCircles();
		d3.select('#sliderDistanceValue').text(this.isoParams.distance);
		d3.select('#sliderWidthValue').text(this.isoParams.width);
		d3.select('#cursorDiameter').text(this.isoParams.cursorDiameter);
	},
	
	addDataSet: function() {
		
		// first update the plots
		this.updatePlots(this);
		
		this.dataCnt++;
		var num = this.dataCnt;
		var colour = this.colour(randomAB(0, 10));
		
		this.data[num] = {data: [], colour: colour};
		
		this.currentDataSet = num
		var div = d3.select('#dataSets').append('div')
			.attr('id', 'dataSet' + num)
			.text('Data Set ' + num + ' ')
			.style('background-color', colour);
		
		var buttonID ='removeDataSet' + num;
		div.append('button')
			.attr('id', buttonID)
			.attr('type', 'button')
			.text('delete!');
			
		var that = this;
		
		$('#' + buttonID).click(function() {
			that.deleteDataSet(num);
			fittsTest.active = false;
		});
		
		$('#dataSet' + num).click(function() {
			if (assIsKey(num, that.data)) {
				that.currentDataSet = num;
				that.highlightDataSet(num);				
			}
			fittsTest.active = false;

		})
			
		this.highlightDataSet(num);
		// add colour
		
	},
	
	deleteDataSet: function(num) {
		if (assSize(this.data) == 1)
		{
			alert('Cannot delete data set! Create another data set first.')
		} else
		{	
			d3.select('#dataSet' + num).remove();
			delete this.data[num];
			
			scatterGroup.selectAll('.cat' + num)
				.transition()
					.duration(500)
						.attr('r', 0)
						.remove();
			
			scatterEffectiveGroup.selectAll('.cat' + num)
				.transition()
					.duration(500)
						.style('opacity', 0)
						.remove();
			
			throughputGroup.selectAll('rect.cat' + num)
				.transition()
					.duration(500)
						.attr('width', 0)
						.remove();
						
			positionEffectiveGroup.selectAll('line.cat' + num)
				.transition()
					.duration(500)
						.style('opacity', 0)
						.remove()
			
			speedEffectiveGroup.selectAll('line.cat' + num)
				.transition()
					.duration(500)
						.style('opacity', 0)
						.remove()
			
			if (num == this.currentDataSet) {
				var first = parseInt(assFirstKey(this.data));
				this.currentDataSet = first;
				this.highlightDataSet(first);
			}
			
			this.updatePlots(this);
		}
	},
	
	highlightDataSet: function(num) {
		d3.selectAll('#dataSets div')
			.attr('class', '');
		d3.select('#dataSet' + num)
			.attr('class', 'active')
	},
	
	updatePlots: function(that) {
		// a little I candy :D
		d3.select('body').append('div')
			.attr('class', 'msg')
			.text('updating plots...')
			.style('opacity', 1)
			.transition()
				.duration(2000)
					.style('opacity', 0)
					.remove();
					
		/* we haven't moven inside the test area, so we can as well disable
		 * the test for now
		 */
		that.active = false;

		// for each data set
		// compute We and IDe and Throughput for each category

		// process data
		var dataSetIndex = -1; // evil hack to make it start at 0 then.
		for (var key in that.data) { // for each data set
			
			dataSetIndex++;
			
			var groups = [];
			for (var i = 0; i < that.data[key].data.length; i++) { // for each datum
				var datum = that.data[key].data[i];
				var groupID = datum.distance.toString() + datum.width.toString();
				if (!groups[groupID]) {
					groups[groupID] = [];
				}
				
				var q = project(datum.start, datum.target, datum.hit);
				// var x = distance(q, datum.start) * sign(q.t);
				var y = distance(q, datum.hit) * isLeft(datum.start, datum.target, datum.hit);
				
				datum.realDistance = distance(datum.start, datum.hit); // use real distance here.
				datum.projectedHitOffsetX = distance(q, datum.target) * sign(q.t - 1);
				datum.projectedHitOffsetY = y;
				
				groups[groupID].push(datum);
			}

			var newData = [];
			for (var group in groups) {
				if (groups[group].length < 3) { // exlcude groups with length < 3
					continue;
				}
					
				var xEffective = 4.133 * Math.sqrt(variance(groups[group], function(d) { return d.projectedHitOffsetX; }))
				var yEffective = 4.133 * Math.sqrt(variance(groups[group], function(d) { return d.projectedHitOffsetY; }))
				var dEffective = mean(groups[group], function(d) { return d.realDistance; });
				
				for (var i = 0; i < groups[group].length; i++) {
					var datum = groups[group][i];
					var We = Math.min(xEffective, yEffective); // SMALLER-OF model (MacKenzie, Buxton 92)
					var De = dEffective;
					datum.IDe = fitts(De, We);
					datum.throughput = 1000 * (datum.IDe/datum.time);
					newData.push(datum);
				}
			}
			
			
			// insert stuff in SVG
			var colour = that.data[key].colour;
			
			var insert = function(d) {
				d.attr('cx', function(d) { return effScatterX(d.IDe); })
				.attr('cy', function(d) { return effScatterY(d.time); })
				.attr('r', 5);
			}
			
			var circles = scatterEffectiveGroup.selectAll('circle.cat' + key)
				.data(newData);
			
			circles.enter()
				.append('circle')
					.attr('class', 'cat' + key)
					.style('fill', colour)
					.style('opacity', 0.5)
					.call(insert);
			
			circles.transition()
				.duration(500)
					.call(insert);
					
					
			// ==================== regression ========================
			var covTIDe = cov(newData,
				function(d) { return d.time; },
				function(d) { return d.IDe});
			
			var varIDe = variance(newData, function(d) { return d.IDe; })
			
			if (varIDe > 0)
				var b = covTIDe / varIDe;
			else
				var b = 0;
			
			var mT = mean(newData, function(d) { return d.time; });
			var mIDe = mean(newData, function(d) { return d.IDe; });
			var a = mT - b * mIDe;
			
			if (!isNaN(a))
			{			
				var makeLine = function(d) {
					return d
						.attr('x1', 0)
						.attr('x2', scatterEffectiveDimension.innerWidth)
						.attr('y1', function(d) { return effScatterY(d.y1); })
						.attr('y2', function(d) { return effScatterY(d.y2); })
				}
			
				var regression = scatterEffectiveGroup.selectAll('line.cat' + key)
					.data([{y1:a + b * 0.5, y2: a + b * 6.5}]);
			
				regression.enter().append('line')
					.attr('class', 'cat' + key)
					.style('stroke', colour)
					.style('stroke-width', 2)
					.call(makeLine);
			
				regression.transition()
					.call(makeLine);
			}
				

			// ============== histogram ====================
			var histThroughput = d3.layout.histogram()
				.bins(20)
				.range([0,10])
				.value(function(d){return d.throughput;})
				
			var throughputHistogramData = histThroughput(newData)
			
	//		histYMax = d3.max(throughputHistogramData, function(d) { return d.y; });
						
			var histX = d3.scale.ordinal()
				.domain(throughputHistogramData.map(function(d) { return d.x; }))	
				.rangeRoundBands([0, histDimension.innerWidth]);
	
			var histY = d3.scale.linear()
				.domain([0, d3.max(throughputHistogramData, function(d) { return d.y; })])
				.range([histDimension.innerHeight, 0]);
				
			var throughputRect = throughputGroup.selectAll('rect.cat' + key)
				.data(throughputHistogramData);
				
			
			var numDataSets = assSize(that.data);
			var xOffset = (histX.rangeBand() / numDataSets) * dataSetIndex;
			
			var makeRect = function(d) {
				d.attr('x', function(offset) { return function(d) { return (histX(d.x) + offset); }; }(xOffset))
				.attr('y', function(scale) { return function(d) { return (scale(d.y)); }; }(histY))
				.attr('width', (histX.rangeBand() / numDataSets) - 1)
				.attr('height', function(scale) { return function(d) { return (scale(0) - scale(d.y)); }; }(histY));
			}
			
			var histXAxis = d3.svg.axis()
				.scale(histX)
				.ticks(2);

			var histYAxis = d3.svg.axis()
				.scale(histY)
				.ticks(5)
			throughputGroup.selectAll("g.axis").remove()	
			
			throughputGroup.append("g")
				.attr("class", "axis")
				.attr("transform", "translate(0," + histDimension.innerHeight + ")")
				.call(histXAxis.tickSize(6,3,6).orient("bottom"));	
	
			// throughputGroup.append("g")
				// .attr("class", "axis")
				// .call(histYAxis.tickSize(-histDimension.innerWidth).orient("left"));
			
			throughputRect.enter()
				.append('rect')
				.attr('class', 'cat' + key)
				.attr('rx', 2)
				.attr('ry', 2)
				.style('fill', colour)
				.call(makeRect)
				
			throughputRect.transition()
				.duration(500)
				.call(makeRect)
				
			// ==================== eff position and speed ===================
			// more or less copy-pasted from above
			for (var i = 0; i < newData.length; i++)
			{
				var last = { x: 0, y: 0, t: newData[i].start.t, v: 0};
				var A = newData[i].start;
				var B = newData[i].target
				var dAB = distance(A, B);
				var offset = newData[i].distance - dAB;
				offset = 0;
								
				for (var j = 0; j < newData[i].path.length; j++)
				{

					var p = newData[i].path[j];
			
					var q = project(A, B, p);
					var x = distance(q, A) * sign(q.t);
					var y = distance(q, p) * isLeft(A, B, p);

					var dt = p.t - last.t;
					var dist = distance(last, {x: x, y: y});
					if (dt > 0)
						var speed = dist / dt;
					else
						var speed = 0;
		
					positionEffectiveGroup.append('line')
						.attr('class', 'cat' + key)
						.attr('x1', effPositionX(last.x + offset))
						.attr('x2', effPositionX(x + offset))
						.attr('y1', effPositionY(last.y))
						.attr('y2', effPositionY(y))
						.style('stroke', colour)
						.style('opacity', 0.5);
			
					speedEffectiveGroup.append('line')
						.attr('class', 'cat' + key)
						.attr('x1', effSpeedX(last.t - A.t))
						.attr('x2', effSpeedX(p.t - A.t))
						.attr('y1', effSpeedY(last.v))
						.attr('y2', effSpeedY(speed))
						.style('stroke', colour)
						.style('opacity', 0.5);
					
					var last = {}
					last.x = x;
					last.y = y;
					last.t = p.t;
					last.v = speed;
				}
			}
		}		
	}
};

// _empirical_ covariance
function cov(data, extractorA, extractorB) {
	
	if (data.length <= 1) { // no covariance for 0 or 1 element.
		return 0;
	}

	var mA = mean(data, extractorA);
	var mB = mean(data, extractorB);
	
	var cov = 0;
	for (var i = 0; i < data.length; i++) {
		cov += (extractorA(data[i]) - mA) * (extractorB(data[i]) - mB);
	}
	
	return cov / (data.length - 1);
}

function variance(data, extractor) {
	return cov(data, extractor, extractor);
}

function mean(data, extractor) {
	var sum = 0;
	for (var i = 0; i < data.length; i++) {
		sum += extractor(data[i]);
	}
	return sum / data.length;
}

function randomAB(a, b) {
	return a + Math.random() * (b - a);
}

function assSize(assArr) {
	var size = 0;
	for (var _ in assArr) {
		size++;
	}
	return size;
}

function assFirstKey(assArr) {
	for (var key in assArr) {
		return key;
		break;
	}
}

function assIsKey(needle, assArr) {
	for (var key in assArr) {
		if (needle == key) {
			return true;
		}
	}
	return false;
}


/**
 * Project a point q onto the line p0-p1
 * Code taken from: http://www.alecjacobson.com/weblog/?p=1486
 */
function project(A, B, p) {
	var AB = minus(B, A);
	var AB_squared = dot(AB, AB);
	if (AB_squared == 0) {
		return A;
	}
	else {
		var Ap = minus(p, A);
		var t = dot(Ap, AB) / AB_squared;
		return {x: A.x + t * AB.x,
				y: A.y + t * AB.y,
				t: t};
	}
}



function mouseMoved()
{
	if(!fittsTest.gamepadMode) {
		var m = d3.svg.mouse(this);
		fittsTest.mouseMoved(m[0], m[1])
	}
}

function mouseClicked()
{
	if(!fittsTest.gamepadMode) {
		var m = d3.svg.mouse(this);
		fittsTest.mouseClicked(m[0], m[1]);
	}
}

function dot(a, b) {
	return (a.x * b.x) + (a.y * b.y);
}

// coutesy of http://stackoverflow.com/questions/3461453/determine-which-side-of-a-line-a-point-lies
function isLeft(A, B, p){
     return ((B.x - A.x)*(p.y - A.y) - (B.y - A.y)*(p.x - A.x)) >= 0 ? 1: -1;
}

function minus(a, b) {
	return {x: a.x - b.x, y: a.y - b.y};
}

function distance(a, b) {
	var dx = a.x - b.x;
	var dy = a.y - b.y;
	return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
}

function sign(a) {
	return a >=0 ? 1 : -1;
}

function rgb2Hex(r, g, b) {
	return '#' +
		clampInt(0, 255, r).toString(16) +
		clampInt(0, 255, g).toString(16) +
		clampInt(0, 255, b).toString(16);
}

function clampInt(lower, upper, x) {
	return Math.min(upper, Math.max(lower, Math.floor(x)));
}

function fitts(A, W) {
	//return Math.log2((2*A) / W);
	return Math.log2((A/W) + 1);
}

function invertedFitts(A, ID) {
	return A / (2**(ID)-1)
}

function shuffle(array) {
	for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

function removeMinMax(objectArray) {
	var time_values = objectArray.map(obj => obj.time)
	var max_time = Math.max(...time_values)
	var min_time = Math.min(...time_values)
	return objectArray.filter(obj => obj.time != max_time && obj.time != min_time)
}

function removeMinMaxByID(objectArray) {
	fittsTest.IDs.forEach((id) => {
		var time_values = objectArray.filter(obj => obj.id == id).map(obj => obj.time)
		var max_time = Math.max(...time_values)
		var min_time = Math.min(...time_values)
		objectArray = objectArray.filter(obj => obj.time != max_time && obj.time != min_time)
	})
	return objectArray
}

function getAveragesByID(objectArray) {
	let averages = []
	fittsTest.IDs.forEach((id) => {
		const filtered_objects = objectArray.filter(obj => obj.id == id);
		let first_object = filtered_objects.length > 0 ? filtered_objects[0] : null;
		if(first_object != null) {
			let time_values = filtered_objects.map(obj => obj.time)
			let distance_values = filtered_objects.map(obj => obj.distance)
			first_object.time =  time_values.reduce((a, b) => a + b, 0) / time_values.length;
			first_object.distance =  distance_values.reduce((a, b) => a + b, 0) / distance_values.length;
			averages.push(first_object)
		}
	})
	return averages
}


const cursor = document.getElementById("cursor");
var connected_gamepad = null;
var gamepad_position = {x:0,y:0}
function mouseMovedGamepad() {

	if(connected_gamepad != null && fittsTest.gamepadMode) {

		// DONE : Change cursor size for step 1
		/*if ((fittsTest.experimentStep == 0 && fittsTest.experimentStartWithGamepad) || (fittsTest.experimentStep == 1 && !fittsTest.experimentStartWithGamepad)){
			//fittsTest.isoParams.cursorDiameter = $("#cursor").width();
			fittsTest.isoParams.cursorDiameter = 1;
		}*/

		const gp = connected_gamepad.axeValues[0];

		var x_val = Math.abs(gp[0]) <= 0.1 ? 0 : gp[0];
		var y_val = Math.abs(gp[1]) <= 0.1 ? 0 : gp[1];

		var top = (parseInt(cursor.style.top, 10) + y_val*fittsTest.gamepadSensibility)
		var left = (parseInt(cursor.style.left, 10) + x_val*fittsTest.gamepadSensibility) 

		// decrease sensibility if close to the target 

		cursor.style.top =  top + "px";
		cursor.style.left =  left + "px";

		var offset = $('#test-area').offset();	
		var new_x = left - offset.left
		var new_y = top - offset.top

		if(gamepad_position.x != new_x || gamepad_position.y != new_y) {
			fittsTest.mouseMoved(new_x, new_y);
			gamepad_position.x = new_x
			gamepad_position.y = new_y
		}
	}
}


function mouseClickedGamepad() {
	if(connected_gamepad != null && fittsTest.gamepadMode) {
		const gp = connected_gamepad.axeValues[0];

		var x_val = Math.abs(gp[0]) <= 0.1 ? 0 : gp[0];
		var y_val = Math.abs(gp[1]) <= 0.1 ? 0 : gp[1];

		var top = (parseInt(cursor.style.top, 10) - 8 + y_val*fittsTest.gamepadSensibility)
		var left = (parseInt(cursor.style.left, 10) - 8 + x_val*fittsTest.gamepadSensibility) 

		var offset = $('#test-area').offset();	
		fittsTest.mouseClicked(left - offset.left, top - offset.top)
	}
}

function connectGamepad() {
	testAreaSVG.style('cursor','none')
	$('#cursor').show()
	gameControl.on('afterCycle', mouseMovedGamepad)
	if(connected_gamepad != null) {
		connected_gamepad.before('button0', mouseClickedGamepad);
	}
}

function disconnectGamepad() {
	testAreaSVG.style('cursor','auto')
	$('#cursor').hide()
	gameControl.off('afterCycle', mouseMovedGamepad)
	if(connected_gamepad != null) {
		connected_gamepad.off('button0', mouseClickedGamepad);
	}
}

function positionCursor() {
	var testArea = $("#test-area")
	var offset = testArea.offset();
	var width = testArea.width();
	var height = testArea.height();

	var centerX = offset.left + width / 2;
	var centerY = offset.top + height / 2;

	cursor.style.top =  centerY + "px";
	cursor.style.left =  centerX + "px";
}

function bgRect(d, dim) {
	return d.append('rect')
		.attr('cx', 0)
		.attr('cy', 0)
		.attr('width', dim.width)
		.attr('height', dim.height)
		.attr('class', 'back');
}



var testAreaSVG = d3.select('#test-area').append('svg')
	.attr('width', testDimension.width)
	.attr('height', testDimension.height)
	.style('pointer-events', 'all')
    .on('mousemove', mouseMoved)
	.on('mousedown', mouseClicked)
	.call(bgRect, testDimension);

var plotPositionSVG = d3.select('#plot-positions').append('svg')
	.attr('width', plotPositionDimension.width)
	.attr('height', plotPositionDimension.height)
	.call(bgRect, plotPositionDimension)

var plotPositionGroup = plotPositionSVG.append('g')
	.attr('transform', 'translate('+ plotPositionDimension.left + ', ' + plotPositionDimension.top + ')');

var positionXAxis = d3.svg.axis()
	.scale(scaleX)
	.ticks(7)
var positionYAxis = d3.svg.axis()
	.scale(scaleY)
	.ticks(6)
	
plotPositionGroup.append("g")
    .attr("class", "axis")
    .call(positionXAxis.tickSize(plotPositionDimension.innerHeight).orient("bottom"));
plotPositionGroup.append("g")
    .attr("class", "axis")
    .call(positionYAxis.tickSize(-plotPositionDimension.innerWidth).orient("left"));


	


var plotHitsSVG = d3.select('#plot-hits').append('svg')
	.attr('width', plotHitsDimension.width)
	.attr('height', plotHitsDimension.height)
	.call(bgRect, plotHitsDimension);


var plotHitsGroup = plotHitsSVG.append('g')
		.attr('transform', 'translate('+ plotHitsDimension.cx + ', ' + plotHitsDimension.cy + ')');
plotHitsGroup.append('circle')
	.attr('cx', 0)
	.attr('cy', 0)
	.attr('r', plotHitsDimension.innerWidth/2)
	.style('opacity', 0.1)
plotHitsGroup.append('line')
	.attr('x1', 0)
	.attr('y1', 0)
	.attr('x2', -plotHitsDimension.cx)
	.attr('y2', 0);
plotHitsGroup.append('line')
	.attr('x1', 0)
	.attr('y1', 0)
	.attr('x2', -10)
	.attr('y2', -10);
plotHitsGroup.append('line')
	.attr('x1', 0)
	.attr('y1', 0)
	.attr('x2', -10)
	.attr('y2', 10);

	
	
var plotVelocitiesSVG = d3.select('#plot-velocities').append('svg')
	.attr('width', plotVelocitiesDimension.width)
	.attr('height', plotVelocitiesDimension.height)
	.call(bgRect, plotVelocitiesDimension);

var plotVelocitiesGroup = plotVelocitiesSVG.append('g')
	.attr('transform', 'translate('+ plotVelocitiesDimension.left + ', ' + plotVelocitiesDimension.top + ')');

var speedXAxis = d3.svg.axis()
	.scale(scaleT)
	.ticks(7)
var speedYAxis = d3.svg.axis()
	.scale(scaleV)
	.ticks(6)

plotVelocitiesGroup.append("g")
    .attr("class", "axis")
    .call(speedXAxis.tickSize(plotVelocitiesDimension.innerHeight).orient("bottom"))
	// .append('text')
	// 	.text('time in ms')
	// 	.attr('x', 80)
	// 	.attr('y', plotVelocitiesDimension.innerHeight + 25)
	// 	.style('text-anchor', 'middle');
		
plotVelocitiesGroup.append("g")
    .attr("class", "axis")
    .call(speedYAxis.tickSize(-plotVelocitiesDimension.innerWidth).orient("left"))
		// .append('text')
		// 	.text('pixel/ms')
		// 	.attr('x', -20)
		// 	.attr('y', 80)
		// 	.attr('transform', 'rotate(-90, -20, 80)')
		// 	.style('text-anchor', 'middle');




var scatterSVG = d3.select('#plot-scatter').append('svg')
	.attr('width', plotScatterDimension.width)
	.attr('height', plotScatterDimension.height)
	.call(bgRect, plotScatterDimension);

var scatterGroup = scatterSVG.append('g')
	.attr('transform', 'translate('+ (plotScatterDimension.left) + ',' + plotScatterDimension.top + ' )');

// define Axes.
var xAxis = d3.svg.axis()
	.scale(scatterX)
	.ticks(7)
	.tickSize(6, 3, 0);
var yAxis = d3.svg.axis()
	.scale(scatterY)
	.ticks(6)
	.tickSize(6, 3, 6)
	
// print axes
scatterGroup.append("g")
    .attr("class", "axis")
    .call(xAxis.tickSize(plotScatterDimension.innerHeight).orient("bottom"))
		// .append('text')
		// 	.text('ID')
		// 	.attr('x', 80)
		// 	.attr('y', plotScatterDimension.innerHeight + 25)
		// 	.style('text-anchor', 'middle');
scatterGroup.append("g")
    .attr("class", "axis")
    .call(yAxis.tickSize(-plotScatterDimension.innerWidth).orient("left"))
		// .append('text')
		// 	.text('time in ms')
		// 	.attr('x', -20)
		// 	.attr('y', 65)
		// 	.attr('transform', 'rotate(-90, -20, 80)')
		// 	.style('text-anchor', 'middle');



var scatterEffectiveSVG = d3.select('#scatterEffective').append('svg')
	.attr('width', scatterEffectiveDimension.width)
	.attr('height', scatterEffectiveDimension.height)
	.call(bgRect, scatterEffectiveDimension);

var scatterEffectiveGroup = scatterEffectiveSVG.append('g')
	.attr('transform', 'translate('+ (scatterEffectiveDimension.left) + ',' + scatterEffectiveDimension.top + ' )');

// define Axes.
var effXAxis = d3.svg.axis()
	.scale(effScatterX)
	.ticks(10)
	.tickSize(6, 3, 0);

var effYAxis = d3.svg.axis()
	.scale(effScatterY)
	.ticks(10)
	.tickSize(6, 3, 6)


// print axes
scatterEffectiveGroup.append("g")
    .attr("class", "axis")
	// .attr("transform", "translate( 0, " + plotScatterDimension.height + ")")
    .call(effXAxis.tickSize(scatterEffectiveDimension.innerHeight).orient("bottom"));

scatterEffectiveGroup.append("g")
    .attr("class", "axis")
	// .attr("transform", "translate( 0, " + plotScatterDimension.height + ")")
    .call(effYAxis.tickSize(-scatterEffectiveDimension.innerWidth).orient("left"));

var throughputSVG = d3.select('#throughput').append('svg')
	.attr('width', histDimension.width)
	.attr('height', histDimension.height)
	.call(bgRect, histDimension);

var throughputGroup = throughputSVG.append('g')
	.attr('transform', 'translate('+ (histDimension.left) + ',' + histDimension.top + ' )')

//	.call(histYAxis.tickSize(histDimension.innerWidth).orient("left"));

	

var positionEffectiveSVG = d3.select('#positionEffective').append('svg')
	.attr('width', positionEffectiveDimension.width)
	.attr('height', positionEffectiveDimension.height)
	.call(bgRect, positionEffectiveDimension);

var positionTargetsGroup = positionEffectiveSVG.append('g')
		.attr('transform', 'translate('+ (positionEffectiveDimension.left) + ',' + positionEffectiveDimension.top + ' )');

var positionEffectiveGroup = positionEffectiveSVG.append('g')
	.attr('transform', 'translate('+ (positionEffectiveDimension.left) + ',' + positionEffectiveDimension.top + ' )');

var positionEffXAxis = d3.svg.axis()
	.scale(effPositionX)
	.ticks(10)
	.tickSize(-positionEffectiveDimension.innerHeight)

var positionEffYAxis = d3.svg.axis()
	.scale(effPositionY)
	.ticks(5)
	.tickSize(-positionEffectiveDimension.innerWidth)

positionEffectiveGroup.append('g')
	.attr('class', 'axis')
	.attr('transform', 'translate(0, ' + positionEffectiveDimension.innerHeight + ')')
	.call(positionEffXAxis.orient('bottom'));
	
positionEffectiveGroup.append('g')
	.attr('class', 'axis')
		.call(positionEffYAxis.orient('left'));	
	
	
	

var speedEffectiveSVG = d3.select('#speedEffective').append('svg')
	.attr('width', speedEffectiveDimension.width)
	.attr('height', speedEffectiveDimension.height)
	.call(bgRect, speedEffectiveDimension);

var speedEffectiveGroup = speedEffectiveSVG.append('g')
	.attr('transform', 'translate('+ (speedEffectiveDimension.left) + ',' + speedEffectiveDimension.top + ' )');

var speedEffXAxis = d3.svg.axis()
	.scale(effSpeedX)
	.ticks(10)
	.tickSize(-speedEffectiveDimension.innerHeight)

var speedEffYAxis = d3.svg.axis()
	.scale(effSpeedY)
	.ticks(5)
	.tickSize(-speedEffectiveDimension.innerWidth)

speedEffectiveGroup.append('g')
	.attr('class', 'axis')
	.attr('transform', 'translate(0, ' + speedEffectiveDimension.innerHeight + ')')
	.call(speedEffXAxis.orient('bottom'));

speedEffectiveGroup.append('g')
	.attr('class', 'axis')
	.call(speedEffYAxis.orient('left'));

// init code
shuffle(fittsTest.IDs)
$('#experiment_trial_title').hide()
$('#number_of_experiment_trials').text(fittsTest.IDs.length)
$('#cursor').hide()
fittsTest.randomizeParams();

positionCursor();

// should probably go somewhere else though. 
fittsTest.active = false;
fittsTest.generateISOPositions(15, 150, 10);
fittsTest.updateISOCircles();
d3.select('#sliderDistanceValue').text(fittsTest.isoParams.distance);
d3.select('#sliderWidthValue').text(fittsTest.isoParams.width);
d3.select('#cursorDiameter').text(fittsTest.isoParams.cursorDiameter);
fittsTest.addDataSet();

// setup sliders
$("#sliderDistance").slider({
	min: fittsTest.isoLimits.minD,
	max: fittsTest.isoLimits.maxD,
	step: 1,
	value: fittsTest.isoParams.distance,
	slide: function(event, ui) {
		fittsTest.isoParams.distance = ui.value;
		fittsTest.updateISOCircles();
		d3.select('#sliderDistanceValue').text(ui.value);
		$('#randomizeCheckbox').attr('checked', false);
		fittsTest.isoParams.randomize = false;
	}
});

$("#sliderWidth").slider({
	min: fittsTest.isoLimits.minW,
	max: fittsTest.isoLimits.maxW,
	step: 1,
	value: fittsTest.isoParams.width,
	slide: function(event, ui) {
		fittsTest.isoParams.width = ui.value;
		fittsTest.updateISOCircles();
		d3.select('#sliderWidthValue').text(ui.value);
		$('#randomizeCheckbox').attr('checked', false);
		fittsTest.isoParams.randomize = false;
	}
});

$("#sliderCursor").slider({
	min: fittsTest.isoLimits.minC, // TO DO
	max: fittsTest.isoLimits.maxC, // TO DO
	step: 1,
	value: fittsTest.isoParams.cursorDiameter,
	slide: function(event, ui) {
		fittsTest.isoParams.cursorDiameter = ui.value;
		// fittsTest.updateISOCircles();
		d3.select('#cursorDiameter').text(ui.value);
		$('#randomizeCheckbox').attr('checked', false);
		fittsTest.isoParams.randomize = false;
	}
});

$('#randomizeButton').click(function() {
	fittsTest.randomizeParams();
	$('#randomizeCheckbox').attr('checked', true);
	fittsTest.isoParams.randomize = true;
});

$('#randomizeCheckbox').change(function(event) {
	fittsTest.isoParams.randomize = $(this).attr('checked');
})

$('#addDataSetButton').click(function() {
	fittsTest.addDataSet();
	fittsTest.active = false;
});


$('#training_mode_radio').click(function() {
	fittsTest.switchToTraining();
});

$('#experiment_mode_radio').click(async function() {
	await fittsTest.reinitExperiment(INSTRUCTION_MOUSE)
	fittsTest.experimentStartWithGamepad = false;
	fittsTest.gamepadMode = false;
	console.log('Experiment mode 1')
});

$('#experiment_mode_2_radio').click(async function() {
	await fittsTest.reinitExperiment(INSTRUCTION_GAMEPAD)
	positionCursor();
	connectGamepad()
	fittsTest.experimentStartWithGamepad = true;
	fittsTest.gamepadMode = true;
	console.log('Experiment mode 2')
});

$('#gamepad_mode_radio').click(function() {
	// to do : add cursor diameter
	// change mode
	fittsTest.gamepadMode = true
	connectGamepad()
	console.log('gamepad')
});

$('#mouse_mode_radio').click(function() {
	// to do : remove cursor diameter
	// change mode
	fittsTest.gamepadMode = false
	disconnectGamepad()
	console.log('mouse')
});


gameControl.on('connect', function(gamepad) {
	connected_gamepad = gamepad;
	connected_gamepad.before('button0', mouseClickedGamepad);
});