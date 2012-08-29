/*
*   dog.js - Play different sounds for negative or positive numbers
    (provides playData method to outside)
*/

var context = new webkitAudioContext();
var moneyBuffer = null;
var painBuffer = null;
var moneyFinishedLoading = false;
var painFinishedLoading = false;

var soundQueue = []
var queuePosition = 0

var midiAccess,
output,
outputs = null,
msgSelectOutput = "<br/><br/><div>Please select a MIDI output...</div>",
selectOutput = document.getElementById("outputs"),
debugDiv = document.getElementById("debug-messages"),
messageDiv = document.getElementById("help-message");

window.addEventListener('load', function() {
    if(midiBridge.userAgent === "msie8/win"){
        //midiBridge.wrapElement(document);
        document.body.innerHTML = "This app does not support Internet Explorer 8";
        return;
    }

    /*
    midiBridge.init(function(MIDIAccess){
        
        midiAccess = MIDIAccess;
        outputs = midiAccess.enumerateOutputs();
        debugDiv.innerHTML = outputs

        //create dropdown menu for MIDI outputs and add an event listener to the change event
        midiBridge.createMIDIDeviceSelector(selectOutput, outputs, "output", function(deviceId){
            
            if(output){
                output.close();
            }
            output = midiAccess.getOutput(outputs[deviceId]);
            
            if(deviceId == -1){
                messageDiv.innerHTML = msgSelectOutput;
            }
        });
    });*/

    midiBridge.init({ 
        
        connectAllInputsToFirstOutput: false,
        
        ready: function(msg){
            //contentDiv.innerHTML += msg + "<br/>";

            var devices = midiBridge.getDevices();
            for(var i = 0, max = devices.length; i < max; i++) {
            
                var device  = devices[i];
                var id      = device.id;
                var type    = device.type;
                var name    = device.name;
                var descr   = device.descr;
                var available = device.available;
                debugDiv.innerHTML += id + " : " + type+ " : " + name+ " : " + descr+ " : " + available + "<br/>";
            }
            
        },
        error: function(msg) {
            debugDiv.innerHTML += msg + "<br/>";
        },
        data: function(midiEvent) {
            debugDiv.innerHTML += midiEvent + "<br/>";
        }        
    });

}, false);

function loadMoney() {
  var request = new XMLHttpRequest();
  request.open('GET','/sounds/cash-register-01.wav', true);
  //request.open('GET','DaDeMo_Grand_Piano_Fazioli_Major_Chords_Middle_Pitch.mp3', true);
  // request.open('GET','148488__neatonk__piano-loud-a4.wav', true);
  //request.open('GET','24929__acclivity__phoneringing.mp3', true);

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
      tryPlayNextSoundInQueue()
    }, function(e) {
            console.log(e);
        }
    );
  }
  request.send();
  //alert('money loaded!');

} // end loadMoney

function loadPain() {
  var request = new XMLHttpRequest();
  request.open('GET','/sounds/2319.mp3', true); // OK loud!

  //request.open('GET','/sounds/cash-register-01.wav', true);
  //request.open('GET','DaDeMo_Grand_Piano_Fazioli_Minor_Chords_Higher_Pitch.mp3', true); 
  //
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
      tryPlayNextSoundInQueue()
    }, function(e) {
            console.log(e);
        }
    );
  }
  request.send();
  //alert('money loaded!');
}

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

loadMoney()
loadPain()
var source1 = null, source2 = null

function playMoney(length){
    //while (!moneyBuffer) {
    //}

    source1 = context.createBufferSource(); // creates a sound source
    source1.buffer = moneyBuffer;               // tell the source which sound to play
    source1.connect(context.destination);       // connect the source to the context's destination (the speakers)
    source1.noteOn(0);                          // play the source now
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
