import React, { useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import { IconButton } from "@material-ui/core";
import { FlipCameraIos } from "@material-ui/icons";

const FaceValidation = ({ cropedFaceDescriptor, cropedFaceImages, score }) => {
  const webcamRef = React.useRef(null);
  const [isWebcamOn, setIsWebcamOn] = useState(true);
  const [intervalId, setIntervalId] = useState(null);
  const [quality, setQuality] = useState(1);
  const [facingMode, setFacingMode] = useState("user");
  let mediaStream = null;

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = process.env.PUBLIC_URL + "/models";
      Promise.all([
        faceapi.nets.ssdMobilenetv1.load(MODEL_URL),
        faceapi.nets.faceRecognitionNet.load(MODEL_URL),
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]).then(startWebcam());
    };
    loadModels();
  }, []);

  const startWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: facingMode } },
      });
      if (webcamRef.current) {
        webcamRef.current.video.srcObject = mediaStream;
        webcamRef.current.video.play();
        setIsWebcamOn(true);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const stopWebcam = () => {
    if (webcamRef.current) {
      webcamRef.current.video.pause();
      webcamRef.current.video.srcObject.getTracks()[0].stop();
      setIsWebcamOn(false);
    }
  };

  const handleFacingModeChange = () => {
    setFacingMode(facingMode === "user" ? "environment" : "user");
  };

  const detectFaces = async (image) => {
    const detections = await faceapi
      .detectAllFaces(image, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions()
      .withFaceDescriptors();
    return detections;
  };

  const handleVideoOnPlay = () => {
    const id = setInterval(async () => {
      // Detect faces in the captured photo
      const image = webcamRef.current.video;
      const detection = await detectFaces(image);
      if (detection.length > 0 && detection && cropedFaceDescriptor) {
        const distance = faceapi.euclideanDistance(
          detection[0].descriptor,
          cropedFaceDescriptor[0].descriptor
        );
        setQuality(distance);
        if (distance < 0.6) {
          console.log("The two faces belong to the same person: " + distance);
        } else {
          console.log("The two faces belong to different people: " + distance);
        }
        clearInterval(intervalId);
      }
    }, 1000);
    setIntervalId(id);
  };

  return (
    <>
      <div
        className="webcam-ring"
        style={{ borderColor: quality < 0.6 ? "green" : "red" }}
      >
        <Webcam
          audio={false}
          ref={webcamRef}
          onPlay={handleVideoOnPlay}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: facingMode }}
          style={{
            width: "98%",
            border: "solid 6px",
            //   borderColor: quality < 0.6 ? "green" : "red",
            // filter: "grayscale(100%)",
          }}
        />
      </div>
      <IconButton
        color="secondary"
        aria-label="add to shopping cart"
        onClick={handleFacingModeChange}
        style={{ marginLeft: "auto" }}
      >
        <FlipCameraIos />
      </IconButton>
    </>
  );
};

export default FaceValidation;
