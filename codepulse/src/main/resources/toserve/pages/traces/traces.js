/*
 * Code Pulse: A real-time code coverage testing tool. For more information
 * see http://code-pulse.com
 *
 * Copyright (C) 2014 Applied Visions - http://securedecisions.avi.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function logTime(label, func) {
	var tStart = Date.now(),
		result = func(),
		tEnd = Date.now()
	console.log(label, 'took ', (tEnd-tStart), ' ms')
	return result
}

$(document).ready(function(){
	
	var treemapContainer = $('#treemap-container'),

		// initialize a treemap widget
		treemapWidget = new CodebaseTreemap('#treemap-container .widget-body').nodeSizing('line-count'),
		
		// REST endpoint that generates code coverage data for nodes in the treemap
		treemapDataUrl = document.location.href + '/coverage-treemap.json',

		/*
		 * Create a large spinner (provided by spin.js) that appears in place
		 * of the treemap, before the treemap has loaded. Activate it before
		 * requesting the treemap data from the server.
		 */
		treemapSpinner = (function(){
			var spinner = new Spinner({lines: 17, length: 33, width: 10, radius: 24}),
				target = document.getElementById('treemap-container')

			spinner.spin(target)
			return spinner
		})()

	// When the `treemapColoringStateChanges` fires, use the current `legendData`
	// to generate a new treemap coloring function, and update the treemap's colors
	// with that.
	Trace.treemapColoringStateChanges.toProperty('init').onValue(function(){
		var colorLegend = Trace.getColorLegend()
		var coloringFunc = treemapColoring(colorLegend)
		treemapWidget.nodeColoring(coloringFunc)
	})

	/*
	 * Creates a coloring function that can be used by the treemapWidget,
	 * based on the given `legendData`. Calling this function with no argument
	 * will return the result of the last call to this function (or if it wasn't)
	 * called previously, it will return as if `legendData = {}`).
	 *
	 * Colors are chosen based on the `coverageSet` of each node (stored in `coverageSets`).
	 * If a node was covered by one 'recording', it uses that color. Special cases include
	 * package and root nodes, which are hardwired to grey, and nodes that were covered by
	 * multiple recordings, which are hardwired to purple.
	 */
	function treemapColoring(colorLegend){
		if(!arguments.length){
			var latest = treemapColoring.latest
			if(latest) return latest
			else colorLegend = {}
		}
		var ignoredKinds = d3.set(['package', 'root'])

		var coloringFunc = function(allNodes){

			var activeRecordingIds = Trace.getActiveRecordingIds(),
				allActivityId = Trace.allActivityRecordingId,
				allActivityColor = colorLegend[allActivityId],
				allActivityColorFaded = d3.interpolate('lightgray', allActivityColor)(.2)

			function countActiveCoverings(coverage){
				// if(!coverage) return 0
				var count = 0
				coverage.forEach(function(id){
					if(activeRecordingIds.has(id)){
						count++
					}
				})
				return count
			}

			return function(node){
				if(ignoredKinds.has(node.kind)) return 'grey'

				var coverage = Trace.coverageSets[node.id],
					numCovered = countActiveCoverings(coverage)

				if(numCovered == 0) {
					if(coverage.has(allActivityId)){
						if(activeRecordingIds.empty()) return allActivityColor
						else return allActivityColorFaded
					} else {
						return 'lightgrey'
					}
				}
				if(numCovered > 1) return colorLegend['multi']

				var entryId = undefined
				coverage.forEach(function(id){ if(activeRecordingIds.has(id)) entryId = id })
				var entry = colorLegend[entryId]

				return entry? entry : 'yellow'
			}
		}

		treemapColoring.latest = coloringFunc
		return coloringFunc
	}

	var showTreemap = $('#show-treemap-button').asEventStream('click').scan(false, function(b){ return !b })

	// update some container classes when the treemap drawer goes in and out of view
	showTreemap.onValue(function(show){
		$('#show-treemap-button').toggleClass('expanded', show)
		$('#treemap').toggleClass('in-view', show)
	})

	/*
	 * Request the treemap data from the server. Note that coverage lists
	 * are only specified for the most specific element; for the sake of 
	 * the UI, we "bubble up" the coverage data, so that a parent node is
	 * covered by any trace/segment/weakness that one of its children is
	 * covered by.
	 * 
	 * Once the data has loaded, stop the treemap spinner (mentioned above)
	 * and apply the data to the treemap widget.
	 */
	Trace.onTreeDataReady(function(){

		var controller = new PackageController(Trace.fullTree, $('#packages'), $('#totals'), $('#clear-selections-button'))

		/**
		 * An Rx Property that represents the treemap's TreeData as it
		 * changes due to the PackageWidgets' selection state. 
		 *
		 * When nothing is selected, it uses the full tree; otherwise it 
		 * creates a filtered projection based on the selected packages.
		 */
		var treemapData = controller.selectedWidgets.map(function(sel){
			var hasSelection = (function(){
				for(var k in sel) if(sel[k]) return true
				return false
			})()

			treemapContainer.toggleClass('no-selection', !hasSelection)

			if(hasSelection) {
				return Trace.treeProjector.projectPackageFilterTree(function(n){ return sel[n.id] })
			} else {
				return Trace.treeProjector.projectEmptyTree()
			}
		})

		// Match the 'compactMode' with the 'showTreemap' state.
		showTreemap.onValue(function(show){
			controller.compactMode(show)
			$('.packages-header').toggleClass('compact', show)
		})

		// Highlight the package widgets when trace data comes in
		Trace.liveTraceData.onValue(controller.highlightPackages)

		// Update method coverage counts when the data is changed (or when recording selections change)
		Bacon.onValues(Trace.coverageRecords, Trace.activeRecordingsProp, function(coverage, activeRecordings){
			controller.applyMethodCoverage(coverage, activeRecordings)
		})

		treemapSpinner.stop()
		
		// Set the coloring function and give the treemap data
		treemapWidget
			.nodeColoring(treemapColoring())

		treemapData.onValue(function(tree){
			treemapWidget.data(tree).update()
		})

		Trace.coverageRecords.onValue(setTreemapCoverage)
		Trace.liveTraceData.onValue(treemapWidget.highlightNodesById)

		// Fire a coverage update request in order to get the initial coverage data.
		Trace.traceCoverageUpdateRequests.push('initial load')

		function setTreemapCoverage(recordData){
			var coverageSets = Trace.coverageSets
			function recurse(node){
				var s = coverageSets[node.id] = d3.set(),
					rd = recordData[node.id],
					kids = node.children
				if(rd && rd.length) rd.forEach(function(c){ s.add(c) })
				kids && kids.forEach(function(kid){
					recurse(kid)
					coverageSets[kid.id].forEach(function(c){ s.add(c) })
				})
			}
			recurse(Trace.fullTree.root)
			treemapWidget.nodeColoring(treemapColoring())
		}

		// Property that starts as `false`, but becomes `true` once 
		// the [dismiss] button is clicked in the performance warning
		var slowWarningDismissed = $('#performance-warning a')
			.asEventStream('click')
			.map(function(){ return true })
			.toProperty(false)

		// Add the 'in-view' class to the performance warning if
		// the treemap is running slowly and the alert hasn't been dismissed.
		treemapWidget.isRunningSlowly
			.and(slowWarningDismissed.not())
			.onValue(function(showWarning){
				$('#performance-warning').toggleClass('in-view', showWarning)
			})
	})

	var treemapTooltipContentProvider = {
		/*
		 * Use the node's name as the title in all cases.
		 */
		'calculateTitle': function(node){
			return node.name
		},

		/*
		 * Generates an html tree containing 'name' elements for the node, and all of its
		 * parents up to the nearest package. The <div>s are nested so that each subsequent
		 * level gets an 'indent' class. Each 'name' <div> also gets a '<type>-node' CSS class
		 * for coloring purposes. Package nodes are special-cased to have an empty content;
		 * they are represented only as a title.
		 */
		'calculateContent': (function(){

			return function(node){
				if(node.kind == 'package'){
					return $('<div>')
				} else {

					// wrap the whole result in a <div class='content-padded'>
					var padDiv = $('<div>').addClass('content-padded')

					// Check if the node was encountered by any recordings;
					// if so, create an indication of which ones
					var recordings = Trace.coverageSets[node.id].values()
						.map(function(recId){ return Trace.getRecording(recId) })
						.filter(function(d){ return d })

					if(recordings.length){
						var container = $('<div>')
							.text('Traced by ')
							// .addClass('clearfix')
							.addClass('coverage-area')
						
						recordings.forEach(function(ld){ 
							var bg = ld.getColor,
								lightness = d3.hsl(bg).l,
								textColor = (lightness > 0.4) ? 'black' : 'white'

							$('<div>')
								.addClass('coverage-label')
								.text(ld.getLabel() || 'Untitled Recording')
								.css('background-color', bg)
								.css('color', textColor)
								.appendTo(container)
						})

						padDiv.append(container)
					}

					// calculate path as [node.firstAncestor, ... node.grandparent, node.parent, node]
					// stop traversing upwards once a 'package' node has been reached
					var path = [], i = node
					while(i){
						path.unshift(i)
						if(i.kind == 'package') i = null
						else i = i.parent
					}

					function recurse(i){
						if(i > path.length) return

						var container = $('<div>')

						// everything but the top node gets an indent
						if(i > 0) container.addClass('indent')

						// generate <div class='name'> for the node
						var label = $('<div>')
							.addClass('name')
							.addClass(path[i].kind + '-node')
							.text(path[i].name)
							.appendTo(container)

						// if there are more path elements
						// add the next one to the container
						if(i + 1 < path.length){
							recurse(i+1).appendTo(container)
						}

						return container
					}

					return padDiv.append(recurse(0))
				}
			}
		})()
	}

	treemapWidget.tooltipContentProvider(treemapTooltipContentProvider)

	// Allow the header title to be edited.
	// When it changes, send the change to the server to check for name conflicts
	$('h1.editable').editable().on('edited', function(e, newName){
		TraceAPI.renameTrace(newName, function(reply, error){
			if(!error){
				var hasNameConflict = (reply.warn == 'nameConflict')
				$('.nameConflict').toggleClass('hasConflict', hasNameConflict)
			}
		})
	})
})