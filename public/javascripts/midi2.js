/*
*   midi2.js - Play notes for figures, using MIDI.js
    (provides playData method to outside)
*/

var context = new webkitAudioContext();
var moneyBuffer = null;
var painBuffer = null;
var moneyFinishedLoading = false;
var painFinishedLoading = false;

var soundQueue = []
var queuePosition = 0

function tryPlayNextSoundInQueue(){
    if (painFinishedLoading && moneyFinishedLoading && soundQueue.length){
        var s;
        if (queuePosition < soundQueue.length){
            s = soundQueue[queuePosition]

            for (var j=0; j<s.length; j++){
                if (s[j].type == 'money')
                    playMoney(s[j].length)
                else if (s[j].type == 'pain')
                    playPain(s[j].length)
            }
            queuePosition++
            //stop sounds after: s[0].length*20 ?

            songLength = 10 * 1000  //in milliseconds

            //play next position after delay
            setTimeout(tryPlayNextSoundInQueue, songLength / soundQueue.length)
        }
    }
}

function playNote(length){
    MIDI.noteOn(...);                          // play the source now
    setTimeout("MIDI.noteOff(0)", length)
}


function playData(number, datetime) {
    //play some number with the date/time the event happened
    //this should be a generic interface in both directions
    //pushes events into a queue that is played once the samples are loaded
    
    function convert_to_length(datetime){
        d = new Date(datetime)
        return d.getDate()
    }
    
    //queue one sound for money coming in and another for money going out
    var event
    if (number > 0)
        event = {'type': 'money','length': convert_to_length(datetime), 'datetime': datetime}
    else
        event = {'type': 'pain', 'length': convert_to_length(datetime), 'datetime': datetime}

    last_queue_element = soundQueue.slice(-1)[0] 
    if (last_queue_element && last_queue_element.datetime == datetime) {
        //we have two data at the same time, add them into one event
        soundQueue[soundQueue.length-1].push(event)
    }
    else {
        //new event (new position)
        soundQueue.push([event])
    }

    if (queuePosition == 0){
        tryPlayNextSoundInQueue()
    }
}
