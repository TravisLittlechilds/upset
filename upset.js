/**
 * author: Alexander Lex - alex@seas.harvard.edu Inspired by ?
 * author: Nils Gehlenborg - nils@hms.harvard.edu
 */


d3.json("datasets.json", function (error, json) {
    if (error) return console.warn(error);
    dataSets = json;
    load()
});

function load() {

    // Variables from query string
    var queryParameters = {}, queryString = location.search.substring(1),
        re = /([^&=]+)=([^&]*)/g, m;

    // Creates a map with the query string parameters
    while (m = re.exec(queryString)) {
        queryParameters[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
    }

    queryParameters['dataset'] = parseInt(queryParameters['dataset']) || 0;

    var header = d3.select("#header");
    header.append('div').html('&darr; # intersections.').attr({id: 'sortIntersect',
        class: 'myButton'})

    header.append('div').html('Group by set size.').attr({id: 'groupSetSize',
        class: 'myButton'})

    var dataSelect = header.append('div').text('Choose Dataset: ');
    var select = dataSelect.append("select");
    select.on("change", change)
        .selectAll("option").data(dataSets).enter().append("option")
        .attr("value", function (d) {
            return d.file;
        })
        .attr("id", "dataSetSelector")
        .text(function (d) {
            return d.text;
        })
        .property("selected", function(d, i) {
          if(i==queryParameters['dataset'])
            return true;
          else
            return false;
        });

    loadDataset(dataSets[queryParameters['dataset']].file);
}

function loadDataset(dataFile) {
    d3.text(dataFile, "text/csv", dataLoad);
}

function dataLoad(data) {

    clearSelectedItems();

    var dsv = d3.dsv(";", "text/plain");
    var rows = dsv.parseRows(data).map(function (row) {
        return row.map(function (value) {
            var intValue = parseInt(value, 10)
            if (isNaN(intValue))
                return value;
            return intValue;
        });
    });
    // the raw set arrays
    var rawSets = [];
    // the names of the sets are in the columns
    var setNames = rows.shift();
    // we drop the first cell - this should be empty
    setNames.shift();

    // initialize the raw set arrays
    for (var setCount = 0; setCount < setNames.length; setCount++) {
        rawSets.push(new Array());
    }

    for (var i = 0; i < rows.length; i++) {
        labels.push(rows[i][0]);
        for (var setCount = 0; setCount < setNames.length; setCount++) {
            rawSets[setCount].push(rows[i][setCount + 1]);
        }
    }

    depth = labels.length;

    var setID = 1;
    for (var i = 0; i < rawSets.length; i++) {
        var combinedSets = Array.apply(null, new Array(rawSets.length)).map(Number.prototype.valueOf, 0);
        combinedSets[i] = 1;
        var setName = setNames[i];
        var set = new Set(setID, setName, combinedSets, rawSets[i]);
        setID = setID << 1;
        sets.push(set);
    }

    combinations = Math.pow(2, sets.length) - 1;

    for (var i = 1; i <= combinations; i++) {
        makeSubSet(i)
    }

    renderRows = subSets.slice(0);
    groupBySetSize();
    // sort by size of set overlap
    renderRows.sort(function (a, b) {
        return b.setSize - a.setSize;
    });

    plot();

}

function change() {
    sets.length = 0;
    subSets.length = 0;
    renderRows.length = 0;
    labels.length = 0;
    loadDataset(this.options[this.selectedIndex].value);
    history.replaceState({}, "Upset", window.location.origin+window.location.pathname+"?dataset="+this.selectedIndex);
}

function setSelectedItems(indices) {
    selectedItems = indices;

    plotSelectedItems();
}

function clearSelectedItems() {
    selectedItems.length = 0;

    plotSelectedItems();
}

function plot() {

    var cellDistance = 20;
    var cellSize = 18;
    var textHeight = 60;
    var textSpacing = 3;

    var majorPadding = 5;
    var xStartSetSizes = cellDistance * sets.length + majorPadding;
    var setSizeWidth = 700;
    var subSetSizeWidth = 300;

    /** The width from the start of the set vis to the right edge */


    var xStartExpectedValues = xStartSetSizes + subSetSizeWidth + 20;
    var expectedValueWidth = 300;

    var setVisWidth = expectedValueWidth + subSetSizeWidth + majorPadding + cellDistance + xStartSetSizes;

    var labelTopPadding = 15;

    var paddingTop = 30;
    var paddingSide = 20;

    var truncateAfter = 25;

    var setCellDistance = 12;
    var setCellSize = 10;

    var w = 1300;
    var setMatrixHeight = sets.length * setCellDistance + majorPadding;
    var subSetMatrixHeight;
    var h;

    var rowScale;

    function initRows() {

        subSetMatrixHeight = renderRows.length * cellDistance;
        h = subSetMatrixHeight + textHeight + setMatrixHeight;

        rowScale = d3.scale.ordinal().rangeRoundBands([ setMatrixHeight + textHeight, h ], 0);

        rowScale.domain(renderRows.map(function (d) {
            return d.id;
        }));
    }

    initRows();

    d3.select("#vis").select("svg").remove();
    var svg = d3.select("#vis").append("svg").attr("width", w)
        .attr("height", h);

    //####################### SETS ##################################################

    var rowRientation = "horizontal"; // "vertical"

    if (rowRientation == "horizontal") {

        var setRowScale = d3.scale.ordinal().rangeRoundBands([ 0, setMatrixHeight - majorPadding ], 0);

        setRowScale.domain(sets.map(function (d) {
            return d.id;
        }));

        var setGrp = svg.selectAll('.setRow')
            .data(sets, function (d) {
                return d.id;
            })
            .enter()
            .append('g')
            .attr({transform: function (d, i) {
                return 'translate(0, ' + setRowScale(d.id) + ')';
                //  return 'translate(0, ' + ( cellDistance * (i)) + ')';
            },
                class: 'setRow'});

        // ------------ the connection lines ----------------------

        svg.selectAll('.connection')
            .data(sets)
            .enter()
            .append('polygon')
            .attr({
                points: function (d, i) {

                    // lower edge
                    var subLeft = ( cellDistance * i) + ", " + setMatrixHeight + " ";
                    var subRight = (cellDistance * (i + 1) - 2) + ", " + setMatrixHeight + " ";
                    var setTop = xStartSetSizes + ", " + (setCellDistance * i  ) + " ";
                    var setBottom = xStartSetSizes + ", " + (setCellDistance * (i + 1) - 2) + " ";

                    return (subLeft + subRight + setBottom + setTop );
                },
                class: 'connection'
            }
        );

        // ------------------- set size bars --------------------

        // scale for the size of the subSets, also used for the sets
        var subSetSizeScale = d3.scale.linear().domain([0, d3.max(renderRows, function (d) {
            return d.setSize;
        })]).nice().range([0, subSetSizeWidth]);

        svg.selectAll('.setRow')
            .append('rect')
            .attr({
                class: 'setSize',
                transform: "translate(" + xStartSetSizes + ", 0)", // " + (textHeight - 5) + ")"
                width: function (d) {
                    return subSetSizeScale(d.setSize);
                },
                height: setCellSize//setRowScale.rangeBand()
            });

    } else { // vertical rows

        var setRowScale = d3.scale.ordinal().rangeRoundBands([ 0, sets.length * (cellSize + 2)], 0);

        var subSetSizeHeight = setMatrixHeight - majorPadding;

        setRowScale.domain(sets.map(function (d) {
            return d.id;
        }));

        var setGrp = svg.selectAll('.setRow')
            .data(sets)
            .enter()
            .append('g')
            .attr({transform: function (d, i) {
                return 'translate(' + setRowScale(d.id) + ', 0)';
                //  return 'translate(0, ' + ( cellDistance * (i)) + ')';
            },
                class: 'setRow'});

        // ------------------- set size bars --------------------

        // scale for the size of the subSets, also used for the sets
        var subSetSizeScale = d3.scale.linear().domain([0, d3.max(renderRows, function (d) {
            return d.setSize;
        })]).nice().range([0, subSetSizeHeight]);

        svg.selectAll('.setRow')
            .append('rect')
            .attr({
                class: 'setSize',
                transform: function (d) {
                    return "translate(0, " + (subSetSizeHeight - subSetSizeScale(d.setSize)) + ")"
                }, // " + (textHeight - 5) + ")"
                height: function (d) {
                    return subSetSizeScale(d.setSize);
                },
                width: cellSize//setRowScale.rangeBand()
            });

    }

// ################## SUBSETS #########################

// ------------ the set labels -------------------

    var setLabels = svg.selectAll(".setLabel")
        .data(sets)
        .enter();

    setLabels.append('rect').attr({
        transform: function (d, i) {
            return 'translate(' + (cellDistance * i ) + ', ' + setMatrixHeight + ')';
        },
        width: cellSize,
        height: textHeight - 2,
        class: "connection"
    });

    setLabels.append("text").text(
        function (d) {
            return d.rowName.substring(0, truncateAfter);
        }).attr({
            class: "setLabel",
            id: function (d) {
                return d.rowName.substring(0, truncateAfter);
            },
            transform: function (d, i) {
                return 'translate(' + (cellDistance * (i ) + cellDistance / 2) + ',' + (setMatrixHeight + textHeight - textSpacing) + ')rotate(270)';
            }

        });

//    var rowScale = d3.scale.ordinal().rangeRoundBands([ setMatrixHeight + textHeight, h ], 0);
//
//    rowScale.domain(renderRows.map(function (d) {
//        return d.id;
//    }));

    // ------------------- set size bars header --------------------

    svg.append('rect')
        .attr({
            class: 'labelBackground subsetSizeLabel',
            transform: 'translate(' + xStartSetSizes + ',' + (setMatrixHeight + labelTopPadding) + ')',
            height: '20',
            width: subSetSizeWidth

        });

    svg.append('text').text('Subset Size')
        .attr({
            class: 'columnLabel subsetSizeLabel',
            transform: 'translate(' + (xStartSetSizes + subSetSizeWidth / 2) + ',' + (setMatrixHeight + labelTopPadding + 10) + ')'
        });

    // scale for the size of the plottingSets
    var subSetSizeScale = d3.scale.linear().domain([0, d3.max(renderRows, function (d) {
        return d.setSize;
    })]).nice().range([0, subSetSizeWidth]);

    var subSetSizeAxis = d3.svg.axis().scale(subSetSizeScale).orient("top").ticks(4);

    svg.append("g").attr()
        .attr({class: "axis",
            transform: "translate(" + xStartSetSizes + "," + (setMatrixHeight + textHeight - 5) + ")"
        })
        .call(subSetSizeAxis);

    // ------------ expected value header -----------------------

    svg.append('rect')
        .attr({
            class: 'labelBackground expectedValueLabel',
            // id: ,
            transform: 'translate(' + xStartExpectedValues + ',' + (setMatrixHeight + labelTopPadding) + ')',
            height: '20',
            width: expectedValueWidth

        });

    svg.append('text').text('Deviation from Expected Value')
        .attr({
            class: 'columnLabel expectedValueLabel',
            transform: 'translate(' + (xStartExpectedValues + expectedValueWidth / 2) + ',' + (setMatrixHeight + labelTopPadding + 10) + ')'
        });

    // scale for the size of the plottingSets
    var minDeviation = d3.min(renderRows, function (d) {
        return d.expectedValueDeviation;
    });
    var maxDeviation = d3.max(renderRows, function (d) {
        return d.expectedValueDeviation;
    });

    var expectedValueScale = d3.scale.linear().domain([minDeviation, maxDeviation]).nice().range([0, expectedValueWidth]);

    var expectedValueAxis = d3.svg.axis().scale(expectedValueScale).orient("top").ticks(4);

    svg.append("g").attr()
        .attr({class: "axis",
            transform: "translate(" + xStartExpectedValues + "," + (setMatrixHeight + textHeight - 5) + ")"
        })
        .call(expectedValueAxis);

    plotSubSets();
    setUpSortSelections();

    function plotSubSets() {

        // ------------------- the rows -----------------------
        var subSets = svg.selectAll('.row')
            .data(renderRows, function (d) {
                return d.id;
            });

        var grp = subSets
            .enter()
            .append('g')
            .attr({
                //transform: function (d, i) {
                // return 'translate(0, ' + rowScale(d.id) + ')';
//            return 'translate(0, ' + (textHeight + cellDistance * (i)) + ')';
                //},
                class: function (d) {
                    return 'row ' + d.type;
                }
            });

        subSets.exit().remove();

        //  var rows = svg.selectAll(".row");
        subSets.transition().duration(function (d, i) {
                return 2000;
            }
        ).attr({transform: function (d) {
                return 'translate(0, ' + rowScale(d.id) + ')';

            }, class: function (d) {
                //    console.log(d.type);
                return 'row ' + d.type;
            }});

        // ------------ the combination matrix ----------------------

        var grays = [ "#f0f0f0", "#636363"];
        // scale for the set containment
        var setScale = d3.scale.ordinal().domain([0, 1]).range(grays);

        subSets.filter(function (d) {
            return d.type == ROW_TYPE.SUBSET;
        }).selectAll("g").data(function (d) {
                // binding in an array of size one
                return [d.combinedSets];
            }
        ).enter()
            .append('g')
            .attr({class: 'combination'
            });
//            .each(function (d) {
//                console.log(d);
//            });

        svg.selectAll('.combination').selectAll("rect").data(function (d) {
            return d;
        }).enter()
            .append('rect')
            .on("click", function (d) {
                // click event for cells
            })
            .attr('x', function (d, i) {
                return (cellDistance) * i;
            })
            .attr({width: cellSize,
                height: cellSize})
            .style("fill", function (d) {
                return setScale(d);

            });

        // Handling groups

        var groups2 = svg.selectAll('.row').select(function (d, i) {
            if (d.type === ROW_TYPE.GROUP)
                return this;
            return null;
        })

        groups2.append('rect').attr({
            class: 'groupBackGround',
            width: setVisWidth,
            height: cellSize,
            x: 0,
            y: 0

        })

        //  console.log("g2: " + groups2);

        groups2.append('text').text(function (d) {
            return d.rowName;
        })
            .attr({class: 'groupLabel',
                y: cellSize - 3,
                x: 3,
                'font-size': cellSize - 4
            });

        // ------------------------ set size bars -------------------

        svg.selectAll('.row')
            .append('rect')
            .on("click", function (d) {
                setSelectedItems(d.items);
            })
            .attr({
                class: 'subSetSize',

                transform: function (d) {
                    var y = 0;
                    if (d.type !== ROW_TYPE.SUBSET)
                        y = cellSize / 3 * .4;
                    return   "translate(" + xStartSetSizes + ", " + y + ")"; // " + (textHeight - 5) + ")"
                },

                width: function (d) {
                    return subSetSizeScale(d.setSize);
                },
                height: function (d) {
                    if (d.type === ROW_TYPE.SUBSET)
                        return cellSize;
                    else
                        return cellSize / 3;
                }
            });

        // ----------------------- expected value bars -------------------

        svg.selectAll('.row')
            .append('rect')
            .attr({
                class: function (d) {
                    return d.expectedValueDeviation < 0 ? "expectedValueDeviation negative" : "expectedValueDeviation positive";
                },
                transform: function (d) {
                    var start = expectedValueScale(d3.min([0, d.expectedValueDeviation]));
                    //  console.log(d.name + " expected: " + d.expectedValueDeviation + " start: " + start);
                    start += xStartExpectedValues;
                    var y = 0;
                    if (d.type !== ROW_TYPE.SUBSET)
                        y = cellSize / 3 * 1.7;
                    return "translate(" + start + ", " + y + ")";
                },
                width: function (d) {
                    return Math.abs(expectedValueScale(d.expectedValueDeviation) - expectedValueScale(0));
                },
                height: function (d) {
                    if (d.type === ROW_TYPE.SUBSET)
                        return cellSize;
                    else
                        return cellSize / 3;
                }
            });

    }

// -------------------- row transitions ----------------------------

    function rowTransition() {

//        rowScale = d3.scale.ordinal().rangeRoundBands([ setMatrixHeight + textHeight, h ], 0);
//
//        subSetMatrixHeight = renderRows.length * cellDistance;
//        h = subSetMatrixHeight + textHeight + setMatrixHeight;
//
//        rowScale.domain(renderRows.map(function (d) {
//            return d.id;
//        }));
        initRows();
        plotSubSets();
//        var selection = svg.selectAll(".row").data(renderRows);
//        selection.enter();
//
//        selection.exit().remove();

//
//
//        var rows = svg.selectAll(".row");
//        rows.transition().duration(function (d, i) {
//                return 2000;
//            }
//        ).attr({transform: function (d) {
//                return 'translate(0, ' + rowScale(d.id) + ')';
//            }});

    }

    function setUpSortSelections() {
        d3.selectAll("#sortIntersect").on(
            "click",
            function (d) {
                sortByCombinationSize();
                rowTransition();
            });

        d3.selectAll("#groupSetSize").on(
            "click",
            function (d) {
                sortBySetSizeGroups();
                rowTransition();
            });

        // sort based on occurrence of one specific data item
        d3.selectAll(".setLabel").on(
            "click",
            function (d) {
                sortOnSetItem(d)
                rowTransition();
            });

        d3.selectAll(".subsetSizeLabel").on(
            "click",
            function (d) {
                sortBySubsetSize();
                rowTransition();
            });
        d3.selectAll(".expectedValueLabel").on(
            "click",
            function (d) {
                sortByExpectedValue();
                rowTransition();
            });
    }
}