import * as path from "path";
import * as fs from "fs";

import * as tf from "@tensorflow/tfjs-node";
import Jimp from "jimp";

import * as script from "@superbees/script";

const config = JSON.parse(fs.readFileSync(path.join(script.utils.resources.STORAGE_PATH, "./tutanota-captcha-model/config.json"), "utf8"));

async function prepareImage(imagePath: string | Buffer, padding = 1) {
  // @ts-expect-error
  const image = await Jimp.read(imagePath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  image.scan(0, 0, width, height, function (this: Jimp, x: number, y: number, idx: number) {
    const red = this.bitmap.data[idx + 0];
    const green = this.bitmap.data[idx + 1];
    const blue = this.bitmap.data[idx + 2];
    const alpha = this.bitmap.data[idx + 3];

    if (alpha !== 0 && (red !== 255 || green !== 255 || blue !== 255)) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  });

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width, maxX + padding);
  maxY = Math.min(height, maxY + padding);

  const cropedImage = image.crop(minX, minY, maxX - minX, maxY - minY);

  const resizedImage = cropedImage.resize(config["image_width"], config["image_height"]).grayscale();
  const buffer = await resizedImage.getBufferAsync(Jimp.MIME_PNG);
  return tf.node.decodeImage(buffer, config["image_channels"]).resizeBilinear([config["image_width"], config["image_height"]]).toFloat().div(tf.scalar(255)).expandDims();
}

function decodePrediction(predictionArray: Float32Array) {
  const index = predictionArray.indexOf(Math.max(...predictionArray));

  const hours = Math.floor(index / 12);
  const minutes = (index % 12) * 5;

  const validHours = hours === 0 ? 12 : hours;
  const hoursStr = validHours.toString().padStart(2, "0");
  const minutesStr = minutes.toString().padStart(2, "0");

  return `${hoursStr}:${minutesStr}`;
}

async function runPrediction(imagePath: string | Buffer) {
  const model = await tf.loadLayersModel(`file://${path.join(script.utils.resources.STORAGE_PATH, "./tutanota-captcha-model/model.json")}`);
  const imageTensor = await prepareImage(imagePath);
  const predictionTensor = model.predict(imageTensor) as tf.Tensor;

  const predictionArray = (await predictionTensor.data()) as Float32Array;
  return decodePrediction(predictionArray);
}

export default runPrediction;
