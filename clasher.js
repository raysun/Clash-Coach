    /* 
     * GLOBAL VARIABLES
     */
    var queueCount = 0; // # of opponent's cards (up to 8, first 4 are playable now)
    var cards; // array of card objects
    var finalMinuteScale = 1; // increases to 2 (2x) in final minute
    var prevElixirValue = 0; // Mirror card needs to know previous elixir
    var siri = new SpeechSynthesisUtterance(); // TTS engine

    var bar; // progress bar UI
    var progressBarOptions = {
        strokeWidth: 4,
        //easing: 'easeInOut',
        duration: 6000 * 2.8, // start the game at 6 elixir (6000)
        color: '#ff4dff',
        trailColor: '#eee',
        trailWidth: 4,
        svgStyle: {
            width: '100%',
            height: '100%'
        },
        text: {
            style: {
                // Text color.
                // Default: same as stroke color (progressBarOptions.color)
                color: '#999',
                position: 'absolute',

                right: '0',
                top: '30px',
                padding: 0,
                margin: 0,
                transform: null
            },
            autoStyleContainer: false
        },
        from: {
            color: '#FFEA82'
        },
        to: {
            color: '#ED6A5A'
        },
        step: (state, bar) => {
            bar.setText(Math.round(bar.value() * 10 - 0.5));
            //bar.setText(bar.value());
        }
    };

    $(document).ready(function() {
        // Load Clash Royale card information from a CSV file
        $.ajax({
            type: "GET",
            url: "cardData.csv",
            dataType: "text",
            success: function(cardData) {
                init(cardData);
            }
        });

        // Create the progress bar UI
        bar = new ProgressBar.Line('#container', progressBarOptions);
    });

    $("#progressbar").load(function() {
        $('#progressbar').loadgo();
    }).each(function() {
        if (this.complete) $(this).load();
        $("#progressbar").loadgo("setprogress", 50);
    });



    /*
     * INIT
     * 
     * Called when cards CSV has downloaded. Parses the card info into the card UI, 
     * gets annyang set up, then adds the keyboard search/filter events
     *
     */
    function init(cardData) {
        var regexpCards = "(";
        cards = $.csv.toObjects(cardData);
        cards.forEach(function(card, idx, arr) {
            add(card["name"], card["type"], card["elixir"]);
            regexpCards += card["name"] + '|';
        });
        regexpCards += 'hint)';
        var regexp = new RegExp(regexpCards);

        // Preset the Opponent cards list to all Unknown
        for (i = 0; i < 8; i++) {
            add("Unknown", "Unknown", 0);
        }

        // Let's define our first command. First the text we expect, and then the function it should call
        /*
        var annyangCommands = {
          'show tps report': function() {
            $('#tpsreport').animate({bottom: '-100px'});
          }
        };
        */
        annyangCommands = {
            ':card': {
                'regexp': regexp,
                'callback': function(spokenText) {
                    var idCard = document.getElementById(spokenText.toLowerCase());
                    //if (!idCard) idCard = document.getElementById(spokenText.toLowerCase() + 's');
                    //console.log(idCard);
                    if (spokenText.toLowerCase() == "hint") {
                        giveAdvice();
                    } else if (idCard) {
                        // When speech matches a card, auto-click it & play a feedback beep
                        idCard.click();
                        snd.play();
                    }
                }
            }
        }

        if (annyang) {
            annyang.debug();
            annyang.addCommands(annyangCommands);
            // BUGBUG: Disabling voice recognition during testing
            //annyang.start();
        }

        // Each card determines if it should be hidden or not based on the filter
        // TODO: This works, but we should really keep an array of the cards and manage them
        $(".card").on('filterChanged', function() {
            filter = document.getElementById("filter").value.toLowerCase();
            //console.log(filter);
            /*
            name = this.name.toLowerCase().split(" ",2);
            filter = filter.toLowerCase().split(" ",2);

            filterWords = filter.count();
            */
            //var regex = new RegExp("\\b" + filter.split(" ")[1]);
            name = this.name.toLowerCase();
            var regexStr = "";
            //console.log(filter.split(" "));
            filter.split(" ").forEach(function(word, idx, arr) {
                regexStr == "" ? regexStr += '^' + word : regexStr += '\\S*\\s+' + word;
            });
            var regex = new RegExp(regexStr);
            //console.log(regex);
            if (this.getAttribute("alreadyClicked") == "YES") {
                this.style.visibility = "visible";
            } else {
                if (regex.test(name)) {
                    // if (name.indexOf(filter) == 0 || regex.test(name)) {
                    // if (this.name.toLowerCase().indexOf(filter.toLowerCase()) != -1) {
                    this.style.visibility = "visible";
                } else {
                    this.style.visibility = "hidden";
                }
            }
        });

        // Trigger the card filtering events, and also handle hitting Enter to save the card.
        $("#filter").keyup(function(e) {
            $(".card").trigger('filterChanged');
            if (e.which == 13) {
                var cardsVisible = 0;
                var button;
                $("#cards > .card").each(function(idx) {
                    if (this.style.visibility == "visible") {
                        button = this;
                        cardsVisible++;
                    }
                });
                if (cardsVisible == 1) {
                    button.click();
                }
            }
        });
    }

    function add(name, type, elixirCost) {
        var element = document.createElement("button");
        element.id = name.toLowerCase();
        element.name = name;
        var text = document.createTextNode(name);
        element.appendChild(text);
        element.className = "card";
        element.tabIndex = 1;

        name = name.replace(" ", "_");
        //var cardImage = "img/" + name + "-150x150.png";
        var cardImage = "img/" + name + ".png";
        element.style.backgroundImage = "url('" + cardImage + "')";

        var image = document.createElement("img");
        //image.src = "http://clashmeta.com/wp-content/uploads/2016/03/" + name + ".png";
        image.style = "width:40px";

        if (type == "Unknown") {
            var cardButtons = document.getElementById("opponentCards");
            cardButtons.appendChild(element);
        } else {
            element.onclick = function() {
                //queue.push(name);
                var cardImages = document.getElementById('opponentCards');

                // Clear the filter box (what the user typed)
                document.getElementById("filter").focus();
                document.getElementById("filter").value = "";
                $(".card").trigger('filterChanged');

                //if (!(this.getAttribute("alreadyClicked") == "YES")) queueCount++;
                // If there are fewer than 8 opponent cards & the user clicks a new card, remove one of the Unknown cards and increment the opponent card count
                if (queueCount < 8) {
                    if (this.getAttribute("alreadyClicked") != "YES") {
                        $("#opponentCards > .card")[0].remove();
                        queueCount++;
                    }
                }
                if (queueCount == 8) {
                    // If 8 cards have been clicked, remove the bottom section (area to select a new card)
                    if (document.getElementById("cards")) document.getElementById("cards").remove();
                }

                // appendChild will move (not copy) the current card to the end
                cardImages.appendChild(this);
                this.setAttribute("alreadyClicked", "YES");

                // Handle special case of the Mirror card
                var modElixirCost = parseInt(elixirCost);
                if (name == "Mirror") {
                    modElixirCost = prevElixirValue + 1;
                }
                prevElixirValue = modElixirCost;

                // Update the elixir bar
                newBarValue = bar.value() * 10 - modElixirCost;
                if (newBarValue < 0) newBarValue = 0;

                bar.destroy();
                progressBarOptions.duration = ((10 - newBarValue) * 1000) * 2.8 / finalMinuteScale;
                bar = new ProgressBar.Line('#container', progressBarOptions);
                bar.set(newBarValue / 10);
                bar.animate(1.0); // Number from 0.0 to 1.0

                $("#progressbar").loadgo('setprogress', newBarValue);

                giveAdvice();
            };

            var cardButtons = document.getElementById("cards");
            cardButtons.appendChild(element);
            cardButtons.appendChild(document.createElement("p"));
        }
    }

    function createNewProgressBar(duration) {
        progressBarOptions.duration = ((10 - newBarValue) * 1000) * 2.8 / finalMinuteScale;
        bar = new ProgressBar.Line('#container', progressBarOptions);
    }

    function startFinalMinute() {
        //document.getElementById("finalMinuteButton").style = "visibility:hidden";
        document.getElementById("finalMinuteLabel").innerText = "Final Minute";
        finalMinuteScale = 2;
        newBarValue = bar.value();
        bar.destroy();
        progressBarOptions.duration = (10 * (1 - newBarValue) * 1000) * 2.8 / finalMinuteScale;
        bar = new ProgressBar.Line('#container', progressBarOptions);
        bar.set(newBarValue);
        bar.animate(1.0); // Number from 0.0 to 1.0
    }

    function start() {
        setTimeout(startFinalMinute, 120000);
        bar.set(0.68);
        bar.animate(1.0); // Number from 0.0 to 1.0
        document.getElementById("filter").value = "";
        $(".card").trigger('filterChanged');
        document.getElementById("filter").focus();
    }

    function giveAdvice() {
        // TODO: very beta hacky - trying to provide advice
        var hasBalloonDefense = false;
        var hasSwarmDefense = false;
        $("#opponentCards > .card").each(function(idx) {
            //console.log(idx);
            if (idx < 5) {
                //  console.log(this);
                if (["Archers", "Barbarian Hut", "Bomb Tower", "Fire Spirits", "Fireball", "Freeze", "Ice Wizard", "Inferno Tower", "Lightning", "Minions", "Minion Horde", "Musketeer", "Tesla", "Witch", "Wizard"].indexOf(this.name) != -1) {
                    hasBalloonDefense = true;
                }
                if (["Valkyrie", "Bomber", "Bomb Tower", "Baby Dragon", "Arrows", "Fireball", "Poison", "Witch", "Wizard"].indexOf(this.name) != -1) {
                    hasSwarmDefense = true;
                }
            }
        });
        //console.log('hasSwarmDefense' + hasSwarmDefense);
        if (!hasSwarmDefense) {
            siri.text = "Swarm!";
            //window.speechSynthesis.speak(siri);
        }
        if (!hasBalloonDefense) {
            siri.text = "Float it!";
            //window.speechSynthesis.speak(siri);
        }

    }
