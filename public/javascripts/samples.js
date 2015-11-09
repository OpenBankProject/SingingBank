/*
*   samples.js - Play different sounds for negative or positive numbers
    (provides addData and startPlaying methods to outside)
*/

var context = new webkitAudioContext();
var moneyBuffer = null;
var painBuffer = null;
var moneyFinishedLoading = false;
var painFinishedLoading = false;

var soundQueue = []
var queuePosition = 0
var stop_playing = false

$(document).ready(function(){
    $("#plugin-controls").html("\
      <p> Variations: &nbsp;\
        <a href='/?style=1'> 1 (default) &nbsp;</a> \
        <a href='/?style=2'> 2 &nbsp;</a> \
        <a href='/?style=3'> 3 &nbsp;</a> \
        <a href='/?style=4'> 4 &nbsp;</a> \
      </p>")
})

// not using jquery (yet) so
// from http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values
function getParameterByName(name)
{
  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  var regexS = "[\\?&]" + name + "=([^&#]*)";
  var regex = new RegExp(regexS);
  var results = regex.exec(window.location.search);
  if(results == null)
    return "";
  else
    return decodeURIComponent(results[1].replace(/\+/g, " "));
}



function loadMoney(style) {
  var request = new XMLHttpRequest();
  var sound_file;

  switch(style){
  case "1":
    sound_file = '/sounds/cash-register-01.wav';
    break;
  case "2":
    sound_file = '/sounds/DaDeMo_Grand_Piano_Fazioli_Major_Chords_Middle_Pitch.mp3';
    break;
  case "3":
    sound_file = '/sounds/LS_50019.WAV';
    break;
  case "4":
    sound_file = '/sounds/24929__acclivity__phoneringing.mp3';
    break;
  default:
    sound_file = '/sounds/cash-register-01.wav';
  }


  request.open('GET', sound_file, true);
  request.responseType = 'arraybuffer';

  request.onError = function (e){
    alert ('we got error');
    alert (e);
  }

  // Decode asynchronously
  request.onload = function() {
    context.decodeAudioData(request.response, function(buffer) {
      moneyBuffer = buffer;
      moneyFinishedLoading = true;
    }, function(e) {
            console.log(e);
        }
    );
  }
  request.send();
  //alert('money loaded!');

} // end loadMoney

function loadPain(style) {
  var request = new XMLHttpRequest();

  var sound_file;

  switch(style){
  case "1":
    sound_file = '/sounds/2319.mp3'; //loud!
    break;
  case "2":
    sound_file = '/sounds/DaDeMo_Grand_Piano_Fazioli_Minor_Chords_Higher_Pitch.mp3';
    break;
  case "3":
    sound_file = '/sounds/LS_50006.WAV';
    break;
  case "4":
    sound_file = '/sounds/46415__jobro__dramatic-piano-2.wav';
    break;
  default:
    sound_file = '/sounds/2319.mp3';
  }


  request.open('GET', sound_file, true);

  request.responseType = 'arraybuffer';

  request.onError = function (e){
    alert ('we got error');
    alert (e);
  }

  // Decode asynchronously
  request.onload = function() {
    context.decodeAudioData(request.response, function(buffer) {
      painBuffer = buffer;
      painFinishedLoading = true;
    }, function(e) {
            console.log(e);
        }
    );
  }
  request.send();
  //alert('money loaded!');
}

function startPlaying(){
    if (stop_playing){
        stop_playing = false  //so we can start again afterwards
    } else {
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
                setTimeout(startPlaying, songLength / soundQueue.length)
            }
        }
    }
}

function stopPlaying(){
    stop_playing = true
    source1.noteOff(0)
    source2.noteOff(0)
}

var style = getParameterByName("style")
if (style === ""){
  //console.log("setting style to 1")
  style = "1"
} else {
  //console.log("using style:" + style)
}

loadMoney(style)
loadPain(style)
var source1 = null, source2 = null

function playMoney(length){
    //while (!moneyBuffer) {
    //}

    source1 = context.createBufferSource(); // creates a sound source
    source1.buffer = moneyBuffer;               // tell the source which sound to play
    source1.connect(context.destination);       // connect the source to the context's destination (the speakers)
    source1.noteOn(0);                          // play the source now
    //console.log ("length is " + length)
    setTimeout("source1.noteOff(0)", length)
}


function playPain(length){
    //while (!painBuffer) {
    //}

    source2 = context.createBufferSource(); // creates a sound source
    source2.buffer = painBuffer;                // tell the source which sound to play
    source2.connect(context.destination);       // connect the source to the context's destination (the speakers)
    source2.noteOn(0);                          // play the source now
    setTimeout("source2.noteOff(0)", length)
}


function addData(number, datetime) {
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
}
