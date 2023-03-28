const express = require("express");
const webrtc = require('wrtc');
const { PassThrough } = require('stream')
const { RTCAudioSink, RTCVideoSink } = require('wrtc').nonstandard;

const { EventEmitter } = require('events');

const broadcaster = new EventEmitter();
const { on } = broadcaster;

const app = express();
const port = 3001;
const http = require("http");
const { copyFileSync } = require("fs");
const server = http.createServer(app);

const io = require("socket.io")(server);
app.use(express.static(__dirname + "/public"));
var audioTrack;
var videoTrack;
var peerConnectionStreamers = {};
var peerConnectionViewers = {};

const config = {
    iceServers: [
        /*{
            "urls": "stun:stun.l.google.com:19302",
        }*/
        { 
            "urls": "turn:turn.soporgram.com:3478",
            "username": "cucaracha",
            "credential": "4583013"
        }
    ]
};
let viewers = [];
let streamers = [];
var localStream = new webrtc.MediaStream();
var streams = [];
var views = [];
function getView(streamer, viewer) {
    return {
        streamer: streamer,
        viewer: viewer
    }
};
function getStreamer(id, stream) {
    return {
        id: id,
        stream: stream
    }
};
io.sockets.on("error", e => console.log(e));
io.sockets.on("connection", socket => {
    
    socket.on("unirseStreamer", () => {
        if (viewers.length > 0) {
            io.to(socket.id).emit("statusStream", true);
        }
        else {
            io.to(socket.id).emit("statusStream", false);
        }
        console.log("Streamer conectado: " + socket.id);
        for (let i = 0; i < streamers.length; i++) {
            if (streamers[i] == socket.id) {
                return;
            }
        }
        streamers.push(socket.id);
        

    });
    socket.on("answerViewer", (idStreamer, description) => {
        console.log("Recibiendo answer de: " + idStreamer + socket.id);
        peerConnectionViewers[idStreamer + socket.id].setRemoteDescription(description);
    });
    function esperarConexion(segundos,streamerId){
        setTimeout(() => {
            console.log("Esperando conexion");
            io.to(streamerId).emit("statusStream", true);
        }, segundos);
    }
    socket.on("IniciarViewer",()=>{
        console.log("Viewer conectado: " + socket.id);
        for (let i = 0; i < viewers.length; i++) {
            if (viewers[i] == socket.id) {
                return;
            }
        }
        viewers.push(socket.id);
        console.log("Streamers online: "+ streamers.length);
        console.log("Viewers online: "+ viewers.length);
        if(viewers.length==1){
            var segundos = 1000;
            for(let i=0;i<streamers.length;i++){
                esperarConexion(segundos,streamers[i]);
                segundos = segundos + 1000;
            }
            
        }
        else{
            for (let i = 0; i < streams.length; i++) {
                console.log("Creando conexion con: " + socket.id)
                conectarViewer(socket.id, streams[i]);
            }
        }
    });
    socket.on("unirseViewer", (idStreamer) => {
        

        if (idStreamer == "new") {
            for (let i = 0; i < streams.length; i++) {
                conectarViewer(socket.id, streams[i]);
            }
        }
        else {
            console.log("Creando conexion con: " + socket.id);
            console.log("Streamer id: " + idStreamer);
            console.log("Streams: " + streams.length);
            for(let i=0;i<streams.length;i++){
                console.log(streams[i].id);
            }
            for (let i = 0; i < streams.length; i++) {
                if (streams[i].id == idStreamer) {
                    conectarViewer(socket.id, streams[i]);
                }
            }
        }
        
        /*if(viewers.length==1){
            for(let i=0;i<streamers.length;i++){
                io.to(streamers[i]).emit("statusStream", true);
                
            }
        }*/
        console.log("Streamers online: "+ streamers.length);
        /*if (streams.length == 0) {
            return;
        }*/
        /*var peerConnection = new webrtc.RTCPeerConnection(config);
        for (let i = 0; i < streams.length; i++) {
            streams[i].stream.getTracks().forEach(track => peerConnection.addTrack(track, streams[i].stream));
        }
        peerConnection.onicecandidate = event => {

            if (event.candidate) {

                io.to(socket.id).emit("candidateViewer", "streamer", event.candidate);
            }
        };
        peerConnection
            .createOffer()
            .then(sdp => peerConnection.setLocalDescription(sdp))
            .then(() => {
                io.to(socket.id).emit("offerViewer", "asd", peerConnection.localDescription);
            });
        peerConnectionViewers[socket.id] = peerConnection;
            */


    });
    function conectarViewer(viewId, stream) {
        console.log(stream);
        var peerConnection = new webrtc.RTCPeerConnection(config);
        stream.stream.getTracks().forEach(track => peerConnection.addTrack(track, stream.stream));
        peerConnection.onicecandidate = event => {

            if (event.candidate) {
                console.log("enviando candidato a: " + viewId + " de: " + stream.id + "")
                io.to(viewId).emit("candidateViewer", stream.id, event.candidate);
            }
        };
        peerConnection
            .createOffer()
            .then(sdp => peerConnection.setLocalDescription(sdp))
            .then(() => {
                console.log("enviando offer a: " + viewId + " de: " + stream.id + "")
                io.to(viewId).emit("offerViewer", stream.id, peerConnection.localDescription);
            });
        peerConnectionViewers[stream.id + viewId] = peerConnection;
    }
    socket.on("candidate", (tipo, candidate) => {

        peerConnectionStreamers[socket.id].addIceCandidate(new webrtc.RTCIceCandidate(candidate)).catch(e => console.error(e));
    });
    socket.on("desconectarStreamer", () => {
        //desconectando streamer
        console.log("Desconectando streamer: " + socket.id);
        for (let i = 0; i < viewers.length; i++) {
            console.log("cerrando conexión con: " + socket.id + viewers[i]);

            peerConnectionViewers[socket.id + viewers[i]].close();
            //delete peerConnectionViewers[socket.id+viewers[i]];
        }
        for (let i = 0; i < streams.length; i++) {
            if (streams[i].id == socket.id) {
                streams.splice(i, 1);
            }
        }
        if(peerConnectionStreamers[socket.id]!=null){
            peerConnectionStreamers[socket.id].close();
            delete peerConnectionStreamers[socket.id];
        }
        
    });
    socket.on("offer", (tipo, description) => {
        let peerConnection = new webrtc.RTCPeerConnection(config);
        peerConnection.addEventListener('datachannel', event => {
            const dataChannel = event.channel;
            dataChannel.addEventListener('message', event => {
                console.log('Message from DataChannel "' + dataChannel.label + '" payload "' + event.data + '"');
                console.log(event.data);
                io.to(socket.id).emit("stream", event.data);
            });
        });
        peerConnection.setRemoteDescription(description)
            .then(() => peerConnection.createAnswer())
            .then(sdp => peerConnection.setLocalDescription(sdp))
            .then(() => {
                io.to(socket.id).emit("answer", peerConnection.localDescription);
            });
        peerConnection.oniceconnectionstatechange = event => {
            console.log("Estado de conexión: " + peerConnection.iceConnectionState);

            if (peerConnection.iceConnectionState == "closed") {
                console.log(viewers.length);

                //localStream = new webrtc.MediaStream();
            }
            else if (peerConnection.iceConnectionState == "connected") {
                streams.push(getStreamer(socket.id, localStream));
                localStream = new webrtc.MediaStream();

                //peerConnectionViewers = {};
                for (let i = 0; i < viewers.length; i++) {
                    console.log("Enviando addNewStream: " + viewers[i]);
                    io.to(viewers[i]).emit("addNewStream", socket.id);
                    /*peerConnectionTemp = new webrtc.RTCPeerConnection(config);
                    for(let i = 0;i < streams.length;i++){
                        streams[i].stream.getTracks().forEach(track => peerConnectionTemp.addTrack(track, streams[i].stream));
                    }
                    peerConnectionTemp.onicecandidate = event => {
                            
                        if (event.candidate) {
                            console.log("Recibiendo candidato de: "+viewers[i]);
                            io.to(viewers[i]).emit("candidateViewer", "streamer",event.candidate);
                        }
                    };
                    peerConnectionTemp
                            .createOffer()
                            .then(sdp => peerConnectionTemp.setLocalDescription(sdp))
                            .then(() => {
                                console.log("enviando oferta a: "+viewers[i]);
                                io.to(viewers[i]).emit("offerViewer","asd",peerConnectionTemp.localDescription);
                                });
                    peerConnectionViewers[viewers[i]] = peerConnectionTemp;*/


                }
                //viewers = [];

            }

        };
        peerConnection.ontrack = event => {
            console.log('agregando nuevo track');
            //console.log(event.streams);
            //localStream.addTrack(event.streams[0]);
            //console.log(localStream.addTrack(event.streams));
            localStream.addTrack(event.track);

        };

        //audioTrack = broadcaster.audioTrack = peerConnection.addTransceiver('audio').receiver.track;
        //videoTrack = broadcaster.videoTrack = peerConnection.addTransceiver('video').receiver.track;


        peerConnectionStreamers[socket.id] = peerConnection;
        console.log("Streamers: " + peerConnectionStreamers);
    });
    socket.on("disconnect", () => {
        console.log("Client has disconnected");
        for (let i = 0; i < streamers.length; i++) {
            if (streamers[i] == socket.id) {
                for (let i = 0; i < viewers.length; i++) {
                    if (peerConnectionViewers[socket.id + viewers[i]] != null) {
                        console.log("cerrando conexión con: " + socket.id + viewers[i]);
                        console.log(peerConnectionViewers[socket.id + viewers[i]]);
                        peerConnectionViewers[socket.id + viewers[i]].close();
                        //delete peerConnectionViewers[socket.id+viewers[i]];
                    }
                }
                if (peerConnectionStreamers[socket.id] != null) {
                    peerConnectionStreamers[socket.id].close();
                }

                for (let j = 0; j < streams.length; j++) {
                    if (streams[j].id == socket.id) {
                        console.log("Desconectando stream: " + socket.id + streams[j].id);
                        var idStream = streams[j].stream.id;
                        //utilizar IO para enviar el id del stream a desconectar
                        io.emit("desconectarStream", socket.id);
                        streams[j].stream.getTracks().forEach(track => track.stop());
                        streams.splice(j, 1);
                    }
                }
                console.log("Streams: " + streams.length);
                streamers.splice(i, 1);
                console.log("Streamer desconectado: " + socket.id);
                return;
            }
        }


        for (let i = 0; i < viewers.length; i++) {
            if (viewers[i] == socket.id) {
                if (peerConnectionViewers[socket.id] != null) {
                    peerConnectionViewers[socket.id].close();
                }

                viewers.splice(i, 1);
                console.log("Viewer desconectado: " + socket.id);

            }
        }
        if (viewers.length == 0) {
            io.emit("statusStream", false);
        }
    });
});
server.listen(port, () => console.log(`Server is running on port ${port}`));
