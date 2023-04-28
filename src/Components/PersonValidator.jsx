import React, { useEffect, useState, useRef } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import Tesseract from "tesseract.js";
import Flippy, { FrontSide, BackSide } from "react-flippy";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import { Avatar, Button, Grid, IconButton } from "@material-ui/core";
import FaceValidation from "./FaceValidation";
import { FlipCameraIos } from "@material-ui/icons";

const PersonValidator = () => {
  const flippyRef = useRef();
  const webcamRef = React.useRef(null);
  const [isWebcamOn, setIsWebcamOn] = useState(true);
  const [faceDetections, setFaceDetections] = useState({
    detections: [],
    faceImages: [],
    descriptors: [],
  });
  const [ocrData, setOcrData] = useState({
    extractedFaceScore: 0,
    extractedOcrTextScore: 0,
    extractedOcrText: "",
    croppedFacePhoto: "",
    screenshot: "",
  });
  const [intervalId, setIntervalId] = useState(null);
  const [inFocus, setInFocus] = useState(false);
  const [score, setScore] = useState(0);
  const [isFaceValidation, setIsFaceValidation] = useState(false);
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

  const handleToggleWebcam = () => {
    if (isWebcamOn) {
      stopWebcam();
    } else {
      startWebcam();
    }
  };

  const handleFacingModeChange = () => {
    setFacingMode(facingMode === "user" ? "environment" : "user");
  };

  const takeScreenshot = (filter) => {
    return new Promise((resolve, reject) => {
      try {
        console.log("Taking Screenshot");
        let screenshot = webcamRef.current.getScreenshot();
        //if filter = true will return grayscaleScreenshot 100% (black and white) else return color screenshot
        if (filter) {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const img = new Image();
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.filter = "grayscale(100%)";
            ctx.drawImage(img, 0, 0);
            const grayscaleScreenshot = canvas.toDataURL("image/png");
            console.log("Grayscale screenshot");
            resolve(grayscaleScreenshot);
          };
          img.src = screenshot;
        } else {
          console.log("Color screenshot");
          resolve(screenshot);
        }
      } catch (error) {
        console.log("Error in takeScreenshot function: ", error);
        reject(error);
      }
    });
  };

  const extractOcrText = async (screenshot) => {
    if (screenshot !== null) {
      clearInterval(intervalId);
      console.log("Start extracting OCR Text");
      const config = {
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", //allowed characters
      };
      let tries = 0;
      let highestConfidence = 0;
      let extractData = "";
      while (tries < 2 && highestConfidence < 59) {
        const {
          data: { text, confidence },
        } = await Tesseract.recognize(screenshot, "eng", config);
        console.log(`Try ${tries + 1}: confidence: ${confidence}`);
        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          extractData = text;
          updateExtractedData(extractData, highestConfidence);
        } else {
          updateExtractedData(extractData, highestConfidence);
        }
        tries++;
      }
    }
  };

  const updateExtractedData = (extractData, highestConfidence) => {
    if (ocrData.extractedOcrTextScore < highestConfidence) {
      setOcrData((prevState) => ({
        ...prevState,
        extractedOcrTextScore: highestConfidence,
        extractedOcrText: extractData,
      }));
    }
  };

  const detectFaces = async (image) => {
    const detections = await faceapi.detectAllFaces(image);
    const faceImages = await faceapi.extractFaces(image, detections);
    // const descriptors = await Promise.all(
    //   faceImages.map((face) => faceapi.computeFaceDescriptor(face))
    // );

    const descriptors = await faceapi
      .detectAllFaces(image, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions()
      .withFaceDescriptors();

    return { detections, faceImages, descriptors };
  };

  const handleVideoOnPlay = () => {
    let detect = false;
    const id = setInterval(async () => {
      // Detect faces in the captured photo
      if (webcamRef.current == null) {
        clearInterval(intervalId);
        return;
      }
      const detections = await detectFaces(webcamRef.current.video);
      if (detections.detections.length > 0) {
        if (detections.detections[0].score > 0.96) {
          setInFocus(true);
          setFaceDetections(detections);
          if (detections.faceImages.length > 0 && isWebcamOn && !detect) {
            try {
              detect = true;
              const screenshot = await takeScreenshot(true);
              setOcrData((prevState) => ({
                ...prevState,
                croppedFacePhoto: detections.faceImages[0].toDataURL(),
                screenshot: screenshot,
              }));
              extractOcrText(screenshot);
              console.log(faceDetections);
              stopWebcam(false);
              clearInterval(intervalId);
            } catch (error) {
              console.log("Error in handleVideoOnPlay function: ", error);
              clearInterval(intervalId);
            }
          }
        } else {
          setInFocus(false);
        }
      } else {
        setInFocus(false);
      }
    }, 1000);
    setIntervalId(id);
  };

  useEffect(() => {
    if (!isWebcamOn) handleFlip();
  }, [isWebcamOn]);

  const handleFlip = () => {
    flippyRef.current.toggle();
  };

  return (
    <Grid
      container
      alignItems="center"
      justifyContent="center"
      style={{ height: "100vh" }}
    >
      <Grid item xs={10} md={8} lg={4}>
        <Flippy
          flipOnHover={false}
          flipOnClick={false}
          flipDirection={"horizontal"}
          style={{ height: "600px" }}
          ref={flippyRef}
        >
          <FrontSide>
            {!isFaceValidation ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <div
                  className={`ocrloader ${inFocus ? "" : "error"}`}
                  style={{
                    width: "90%",
                    height: window.innerWidth < 600 ? "40%" : "60%", 
                    marginBottom:window.innerWidth < 600 ? "10%" : "5%"
                  }}
                >
                  <em></em>
                  <p style={{ left: "25%" }}>Focus on the Document</p>
                </div>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  onPlay={handleVideoOnPlay}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: facingMode }}
                  style={{
                    width: "100%",
                    maxHeight: "480px",
                    // transform: "scaleX(-1)",
                  }}
                />
                <IconButton
                  color="secondary"
                  aria-label="add to shopping cart"
                  onClick={handleFacingModeChange}
                  style={{marginLeft:"auto"}}
                >
                  <FlipCameraIos />
                </IconButton>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <FaceValidation
                  cropedFaceDescriptor={faceDetections.descriptors}
                  cropedFaceImages={faceDetections.faceImages}
                />
              </div>
            )}
          </FrontSide>
          <BackSide>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                // alignItems: "center",
                height: "100%",
              }}
            >
              {ocrData.extractedOcrText !== "" ? (
                <>
                  <img
                    src={ocrData.croppedFacePhoto}
                    alt="User face"
                    style={{
                      width: "64px",
                      height: "auto",
                      borderRadius: "10%",
                    }}
                  />
                  <Typography>
                    {"OCR Score: " + ocrData.extractedOcrTextScore}
                  </Typography>
                  <Typography>{ocrData.extractedOcrText}</Typography>
                  <img
                    src={ocrData.screenshot}
                    alt="Screenshot"
                    style={{ width: "auto", maxHeight: "300px" }}
                  />
                  <br />
                  <Button
                    variant="contained"
                    onClick={() => {
                      handleFlip();
                      setIsFaceValidation(true);
                    }}
                  >
                    NEXT
                  </Button>
                </>
              ) : (
                <div className="ocrloader"
                style={{
                  width: "90%",
                  height: window.innerWidth < 600 ? "40%" : "60%",                   
                }}>
                  <p>Scanning</p>
                  <em></em>
                  <span>
                    <img
                      src={ocrData.screenshot}
                      alt="Screenshot"
                      style={{ width: "auto", maxHeight: "300px" }}
                    />
                  </span>
                </div>
              )}
            </div>
          </BackSide>
        </Flippy>
      </Grid>
    </Grid>
  );
};

export default PersonValidator;
