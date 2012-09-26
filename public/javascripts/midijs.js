/*
*   midijs.js - Play notes for figures, using MIDI.js
    (provides addData, startPlaying, stopPlaying methods to outside)
*/

var soundQueue = []
var summed_note_lengths = 0
var min_number_seen = 0
var max_number_seen = 0
var queuePosition = 0
var loader = null
var stop_playing = false
songLength = 100 * 1000  //30 seconds in milliseconds

$(document).ready(function(){
    // Begin loading indication.
    loader = new widgets.Loader({
        message: "loading: Soundfont..."
    })

    MIDI.loadPlugin(function(){
        loader.stop()
    }, "")

})

function create_notes_from_data(data){
    function convert_to_length(datetime){
        var d = new Date(datetime)
        return d.getDate()
    }

    var d
    for(var i=0; i<data.length; i++){
        d = data[i]
        for(var j=0; j<d.length; j++){
            if (d[j].number < 0) {
                //put negative numbers between notes 21 and 55
                d[j].note = (((d[j].number / (min_number_seen)+1)*34)+21).toFixed()
            } else {
                //put positive numbers between 70 and 120
                d[j].note = (((d[j].number / (max_number_seen))*50)+70).toFixed()
            }

            d[j].velocity = 50
            d[j].length = convert_to_length(d[j].datetime)*100
            summed_note_lengths += d[j].length
        }
    }
}

function startPlaying(){
    if(stop_playing){
        stop_playing=false
    } else {
        if (soundQueue.length){
            if (!soundQueue[0][0].note)
                create_notes_from_data(soundQueue)

            var s, keep
            if (queuePosition < soundQueue.length){
                s = soundQueue[queuePosition]
                actual_length = (songLength * s[0].length) / summed_note_lengths

                //multiple notes at the same time
                for (var j=0; j<s.length; j++){
                    keep = false
                    if (j<s.length-1)
                        keep = true
                    playNote(s[j].note, s[j].length, s[j].velocity, keep)
                    
                    $('html,body').animate({
            			scrollTop: $("#"+s[j].element).offset().top-200
                	}, actual_length)

                    $("#"+s[j].element).animate({backgroundColor: "#E6DB74"}, "fast").delay(s[j].length).animate({backgroundColor: "transparent"})
                }
                queuePosition++
                //stop sounds after: s[0].length*20 ?

                //play next position after delay
                setTimeout(startPlaying, actual_length)
            }
        }
    }
}

function stopPlaying(){
    stop_playing = true
    queuePosition = 0
}

function playNote(note, length, velocity, keep_note){
    MIDI.noteOn(0, note, velocity, 0)
    if(!keep_note)
        setTimeout("MIDI.noteOff(0)", length)
}


function addData(number, datetime, element_id) {
    //add some number with the date/time the event happened
    //this should be a generic interface in both directions
    //pushes events into a queue that is played once the samples are loaded
    
    //put data in nice structure for later
    var event = {'number': number, velocity: null, 'length': null, 'datetime': datetime, 'element': element_id}
    if (number > max_number_seen)
        max_number_seen = number
    if (number > min_number_seen)
        min_number_seen = number

    //check if we have had data at the same datetime already, then keep them all in one list
    //we assume that data coming in is in datetime order! (otherwise we would have to search the whole queue)
    last_queue_element = soundQueue.slice(-1)[0] 
    if (last_queue_element && last_queue_element.datetime == datetime) {
        //we have two data at the same time, add them into one event
        soundQueue[soundQueue.length-1].push(event)
    } else {
        //new event (new position)
        soundQueue.push([event])
    }
}
