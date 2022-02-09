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

//! These accessory images are designed for a 720x720 avatar

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
	dimensions: await sizeOf(imagePath),
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
	const noseScarLeftPath = path.join(
		__dirname,
		"../../assets/stickers/scar-nose-left.png"
	);
	const noseScarRightPath = path.join(
		__dirname,
		"../../assets/stickers/scar-nose-right.png"
	);
	const noseScarLeftDimensions = await sizeOf(noseScarLeftPath);
	const noseScarRightDimensions = await sizeOf(noseScarRightPath);
	const noseScar = {
		name: "nose-scar",
		probability: 0.025,
		sticker: {
			left: {
				x: noseScarLeftDimensions.width / 2,
				y: noseScarLeftDimensions.height,
				path: noseScarLeftPath,
				dimensions: noseScarLeftDimensions
			},
			right: {
				x: noseScarRightDimensions.width / 2,
				y: noseScarRightDimensions.height,
				path: noseScarRightPath,
				dimensions: noseScarRightDimensions
			}
		},
		locations: ["nose"],
		elevate: 1,
		directionBy: "pose"
	};

	return [
		{
			name: "cigarette",
			probability: 0.1,
			sticker: {
				left: {
					x: 135,
					y: 135,
					path: path.join(
						__dirname,
						"../../assets/stickers/cigarette-left.png"
					),
					dimensions: await sizeOf(
						path.join(__dirname, "../../assets/stickers/cigarette-left.png")
					)
				},
				right: {
					x: 6,
					y: 135,
					path: path.join(
						__dirname,
						"../../assets/stickers/cigarette-right.png"
					),
					dimensions: await sizeOf(
						path.join(__dirname, "../../assets/stickers/cigarette-right.png")
					)
				}
			},
			locations: ["mouth"],
			elevate: 10,
			directionBy: "pose",
			skipPigmentCheck: true
		},
		{
			name: "vape",
			probability: 0.1,
			sticker: {
				left: {
					x: 70,
					y: 10,
					path: path.join(__dirname, "../../assets/stickers/vape-left.png"),
					dimensions: await sizeOf(
						path.join(__dirname, "../../assets/stickers/vape-left.png")
					)
				},
				right: {
					x: 15,
					y: 10,
					path: path.join(__dirname, "../../assets/stickers/vape-right.png"),
					dimensions: await sizeOf(
						path.join(__dirname, "../../assets/stickers/vape-right.png")
					)
				}
			},
			locations: ["mouth"],
			elevate: 10,
			directionBy: "pose",
			skipPigmentCheck: true
		},
		noseScar,
		{
			name: "eye-scar",
			probability: 0.025,
			sticker: {
				left: {
					x: 0,
					y: 20,
					path: path.join(__dirname, "../../assets/stickers/scar-eye-left.png"),
					dimensions: await sizeOf(
						path.join(__dirname, "../../assets/stickers/scar-eye-left.png")
					)
				},
				right: {
					x: 0,
					y: 20,
					path: path.join(
						__dirname,
						"../../assets/stickers/scar-eye-right.png"
					),
					dimensions: await sizeOf(
						path.join(__dirname, "../../assets/stickers/scar-eye-right.png")
					)
				}
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
					path.join(__dirname, "../../assets/stickers/scar-forehead-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/stickers/scar-forehead-right.png")
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
					path.join(__dirname, "../../assets/stickers/scar-2-forehead-left.png")
				),
				right: await produceSticker(
					path.join(
						__dirname,
						"../../assets/stickers/scar-2-forehead-right.png"
					)
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
				path.join(__dirname, "../../assets/stickers/tattoo.png")
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
				path.join(__dirname, "../../assets/stickers/tattoo-2.png")
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
				path.join(__dirname, "../../assets/stickers/tattoo-3.png")
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
				path.join(__dirname, "../../assets/stickers/tattoo-4.png")
			),
			locations: ["glabella", "cheek-left", "cheek-right"],
			elevate: 1,
			directionBy: "pose"
		},
		{
			name: "tattoo-smiley",
			probability: 0.025,
			sticker: await produceCenterSticker(
				path.join(__dirname, "../../assets/stickers/tattoo-4.png")
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
					path.join(__dirname, "../../assets/stickers/cross-neck-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/stickers/cross-neck-right.png")
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
					path.join(__dirname, "../../assets/stickers/dragon-neck-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/stickers/dragon-neck-right.png")
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
					path.join(__dirname, "../../assets/stickers/bandaid-chin-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/stickers/bandaid-chin-right.png")
				)
			},
			locations: ["chin-left", "chin-right"],
			elevate: 2,
			directionBy: "symmetry"
		},
		{
			name: "bandaid",
			probability: 0.025,
			sticker: {
				left: await produceSticker(
					path.join(__dirname, "../../assets/stickers/bandaid-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/stickers/bandaid-right.png")
				)
			},
			locations: ["cheek-left", "cheek-right"],
			elevate: 2,
			directionBy: "symmetry"
		},
		{
			name: "evil-bandaid",
			probability: 0.01,
			sticker: {
				left: await produceSticker(
					path.join(__dirname, "../../assets/stickers/bandaid-evil-left.png")
				),
				right: await produceSticker(
					path.join(__dirname, "../../assets/stickers/bandaid-evil-right.png")
				)
			},
			locations: ["cheek-left", "cheek-right"],
			elevate: 2,
			directionBy: "symmetry"
		}
	];
};

module.exports = getAccessories;
