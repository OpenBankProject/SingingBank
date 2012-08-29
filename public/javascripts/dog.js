var dogBarkingBuffer = null;
var context = new webkitAudioContext();

function loadDogSound(url) {
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'arraybuffer';

  // Decode asynchronously
  request.onload = function() {
    context.decodeAudioData(request.response, function(buffer) {
      dogBarkingBuffer = buffer;
    }, onError);
  }
  request.send();
}

var moneyBuffer = null;
var painBuffer = null;

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
      var source = context.createBufferSource(); // creates a sound source
      source.buffer = moneyBuffer;                    // tell the source which sound to play
      source.connect(context.destination);       // connect the source to the context's destination (the speakers)
      source.noteOn(0);                          // play the source now
      //alert('after nodeOn');  

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
      var source = context.createBufferSource(); // creates a sound source
      source.buffer = painBuffer;                    // tell the source which sound to play
      source.connect(context.destination);       // connect the source to the context's destination (the speakers)
      source.noteOn(0);                          // play the source now
      //alert('after nodeOn');

      //setTimeout(500, source.noteOff();)  

    }, function(e) {
            console.log(e);
        }
    );
  }
  request.send();
  //alert('money loaded!');

}




