/**
 [
	"mouth",
	"nose",
	"glabella",
	"eye-right",
	"eye-left",
	"chin-right",
	"chin-left",
	"forehead-right",
	"forehead-left",
	"neck-right",
	"neck-left"
 ]
 */

const path = require("path");
const sizeOf = require("image-size");

const getCenterEntryCoords = async (imagePath) => {
	const dimensions = await sizeOf(imagePath);
	return {
		x: Math.round(dimensions.width / 2),
		y: Math.round(dimensions.height / 2)
	};
};

// eg. Used for nose score
const produceSticker = async (imagePath) => ({
	path: imagePath,
	...(await getCenterEntryCoords(imagePath))
});

// eg. Used for tattoos
const produceCenterSticker = async (sticker) =>
	typeof sticker === "string"
		? produceCenterSticker(await produceSticker(sticker))
		: {
				left: sticker,
				right: sticker
		  };

const getAccessories = async () => {
	return [
		{
			name: "cigarette",
			probability: 0.1,
			sticker: {
				left: {
					x: 135,
					y: 135,
					path: path.join(__dirname, "../../assets/cigarette-left.png")
				},
				right: {
					x: 6,
					y: 135,
					path: path.join(__dirname, "../../assets/cigarette-right.png")
				}
			},
			locations: ["mouth"],
			elevate: 10,
			directionBy: "pose"
		},
		{
			name: "vape",
			probability: 0.1,
			sticker: {
				left: {
					x: 135,
					y: 10,
					path: path.join(__dirname, "../../assets/vape-left.png")
				},
				right: {
					x: 12,
					y: 10,
					path: path.join(__dirname, "../../assets/vape-right.png")
				}
			},
			locations: ["mouth"],
			elevate: 10,
			directionBy: "pose"
		},
		{
			name: "nose-scar",
			probability: 0.025,
			sticker: {
				left: await produceSticker(
					path.join(__dirname, "../../assets/scar-nose-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/scar-nose-right.png")
				)
			},
			locations: ["nose"],
			elevate: 1,
			directionBy: "pose"
		},
		{
			name: "eye-scar",
			probability: 0.025,
			sticker: {
				left: await produceSticker(
					path.join(__dirname, "../../assets/scar-eye-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/scar-eye-right.png")
				)
			},
			locations: ["eye-left", "eye-right"],
			elevate: 1,
			directionBy: "symmetry"
		},
		{
			name: "forehead-scar",
			probability: 0.025,
			sticker: {
				left: await produceSticker(
					path.join(__dirname, "../../assets/scar-forehead-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/scar-forehead-right.png")
				)
			},
			locations: ["forehead-left", "forehead-right"],
			elevate: 1,
			directionBy: "symmetry"
		},
		{
			name: "forehead-scar-2",
			probability: 0.025,
			sticker: {
				left: await produceSticker(
					path.join(__dirname, "../../assets/scar-2-forehead-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/scar-2-forehead-right.png")
				)
			},
			locations: ["forehead-left", "forehead-right"],
			elevate: 1,
			directionBy: "symmetry"
		},
		{
			name: "tattoo-1",
			probability: 0.025,
			sticker: await produceCenterSticker(
				path.join(__dirname, "../../assets/tattoo.png")
			),
			locations: [
				"glabella",
				"eye-left",
				"eye-right",
				"forehead-left",
				"forehead-right",
				"cheek-left",
				"cheek-right"
			],
			elevate: 1,
			directionBy: "pose"
		},
		{
			name: "tattoo-2",
			probability: 0.025,
			sticker: await produceCenterSticker(
				path.join(__dirname, "../../assets/tattoo-2.png")
			),
			locations: [
				"glabella",
				"eye-left",
				"eye-right",
				"forehead-left",
				"forehead-right",
				"cheek-left",
				"cheek-right"
			],
			elevate: 1,
			directionBy: "pose"
		},
		{
			name: "tattoo-3",
			probability: 0.025,
			sticker: await produceCenterSticker(
				path.join(__dirname, "../../assets/tattoo-3.png")
			),
			locations: [
				"glabella",
				"eye-left",
				"eye-right",
				"forehead-left",
				"forehead-right",
				"cheek-left",
				"cheek-right"
			],
			elevate: 1,
			directionBy: "pose"
		},
		{
			name: "tattoo-music-note",
			probability: 0.025,
			sticker: await produceCenterSticker(
				path.join(__dirname, "../../assets/tattoo-4.png")
			),
			locations: [
				"glabella",
				"eye-left",
				"eye-right",
				"forehead-left",
				"forehead-right",
				"cheek-left",
				"cheek-right"
			],
			elevate: 1,
			directionBy: "pose"
		},
		{
			name: "tattoo-smiley",
			probability: 0.025,
			sticker: await produceCenterSticker(
				path.join(__dirname, "../../assets/tattoo-4.png")
			),
			locations: [
				"glabella",
				"eye-left",
				"eye-right",
				"forehead-left",
				"forehead-right",
				"cheek-left",
				"cheek-right"
			],
			elevate: 1,
			directionBy: "pose"
		},
		{
			name: "neck-cross-tattoo",
			probability: 0.025,
			sticker: {
				left: await produceSticker(
					path.join(__dirname, "../../assets/cross-neck-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/cross-neck-right.png")
				)
			},
			locations: ["neck-left", "neck-right"],
			elevate: 1,
			directionBy: "symmetry"
		},
		{
			name: "neck-dragon-tattoo",
			probability: 0.025,
			sticker: {
				left: await produceSticker(
					path.join(__dirname, "../../assets/dragon-neck-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/dragon-neck-right.png")
				)
			},
			locations: ["neck-left", "neck-right"],
			elevate: 1,
			directionBy: "symmetry"
		},
		{
			name: "chin-bandaid",
			probability: 0.025,
			sticker: {
				left: await produceSticker(
					path.join(__dirname, "../../assets/bandaid-chin-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/bandaid-chin-right.png")
				)
			},
			locations: ["chin-left", "chin-right"],
			elevate: 1,
			directionBy: "symmetry"
		},
		{
			name: "bandaid",
			probability: 0.025,
			sticker: {
				left: await produceSticker(
					path.join(__dirname, "../../assets/bandaid-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/bandaid-right.png")
				)
			},
			locations: ["cheek-left", "cheek-right"],
			elevate: 1,
			directionBy: "symmetry"
		},
		{
			name: "evil-bandaid",
			probability: 0.01,
			sticker: {
				left: await produceSticker(
					path.join(__dirname, "../../assets/bandaid-evil-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/bandaid-evil-right.png")
				)
			},
			locations: ["cheek-left", "cheek-right"],
			elevate: 1,
			directionBy: "symmetry"
		}
	];
};

module.exports = getAccessories;
