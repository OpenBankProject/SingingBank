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
songLength = 20 * 1000  // seconds in milliseconds

$(document).ready(function(){
    // Begin loading indication.
    loader = new widgets.Loader({
        message: "loading: Soundfont..."
    })

    MIDI.loadPlugin(function(){
        loader.stop()
    }, "")

})

function oc(a)
{
  var o = {};
  for(var i=0;i<a.length;i++)
  {
    o[a[i]]='';
  }
  return o;
}

function put_in_minor_scale(key_start_note, note_number){
    //put midi note into scale
    var mode, octave, pos
    mode = [0,2,3,5,7,8,10]   //harmonic structure
    
    pos = (note_number - key_start_note)%12
    if (pos <0) pos += 12
    if (!(pos in oc(mode))){
        for(var i=0; i<mode.length; i++){
            if (mode[i]>pos){
                note_number += mode[i]-pos
                break
            }
        }
    }
    return note_number
}

function put_in_major_scale_thomas(key_start_note, note_number){
    //put midi note into scale 
    var nr, new_nr, new_note
    nr = note_number - key_start_note  //note number relative to starting note
    nr = Math.floor(7*nr/12)   //number on allowed number range and scaling

    //transform back to full midi note scaling with major scale
    //(each note a full tone step except every 7 and every 3 notes)
    new_nr = 2*nr - 2*Math.floor(nr/7)
    if ((nr%7)>=3) new_nr--
    
    new_note = new_nr+key_start_note
    return(new_note)
}


function create_notes_from_data(data){
    function convert_to_length(datetime){
        var d = new Date(datetime)
        return 36-d.getDate()    //longer notes in the beginning of the month
    }

    var d
    for(var i=0; i<data.length; i++){
        d = data[i]
        for(var j=0; j<d.length; j++){
            if (d[j].number < 0) {
                //put negative numbers between notes 21 and 55
                d[j].note = (((d[j].number / (min_number_seen)+1)*34)+21).toFixed()
                d[j].velocity = 20
            } else {
                //put positive numbers between 70 and 120
                d[j].note = (((d[j].number / (max_number_seen))*50)+70).toFixed()
                d[j].velocity = 60
            }
            
            console.log("Converted "+ MIDI.noteToKey[d[j].note])

            d[j].note = put_in_minor_scale(24,parseInt(d[j].note)) //24 is lowest c
            console.log("to "+ MIDI.noteToKey[d[j].note])

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

            var s, keep, holder_element, holder_colour

            // TODO grab starting font size so can return to it.
            var base_holder_font_size = 12


            if (queuePosition < soundQueue.length){
                s = soundQueue[queuePosition]
                actual_length = (songLength * s[0].length) / summed_note_lengths

                //multiple notes at the same time
                for (var j=0; j<s.length; j++){
                    keep = false
                    if (j<s.length-1)
                        keep = true
                    
                    console.log('note is:' + s[j].note)

                    playNote(s[j].note, s[j].length, s[j].velocity, keep)
                    
                    
                    $('html,body').animate({
            			scrollTop: $("#"+s[j].element).offset().top-200
                	}, actual_length)

                    console.log('element is: ' + s[j].element)
                    console.log('number is: ' + s[j].number)

                    holder_id = "other_account_holder_" +s[j].element
                    holder_font_size = base_holder_font_size + (Math.abs(s[j].number) / 50)

                    if (s[j].number > 0)
                        $("#"+holder_id).addClass("moneyin")
                    else
                        $("#"+holder_id).addClass("moneyout")

                    $("#"+s[j].element).animate({backgroundColor: "#E6DB74"}, "fast").delay(s[j].length).animate({backgroundColor: "transparent"})
                    $("#"+holder_id).animate({fontSize: holder_font_size}, "slow").delay(s[j].length).animate({fontSize: "12"})

                    // TODO turn on font colour before animating.
                    //$("#"+holder_id).fontSize = 55


                    $("#"+holder_id).animate({color: holder_colour}, "fast").delay(s[j].length).animate({color: "#555"})



                    //$("#"+holder_id).color = "#E6DB74" // holder_colour

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
