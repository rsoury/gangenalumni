/**
 * Data Step 2
 *
 * Use the Collected Data to produce NFT metadata
 * Data comes from Accessories, Enhancements, and Face Recognition
 *
 * Metadata Standards:
 * https://docs.opensea.io/docs/metadata-standards
 * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md
 * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1155.md#erc-1155-metadata-uri-json-schema
 *
 * Example Command:
 * yarn metadata --input ./output/step1/1641949185310/33.jpeg --face-data ./data/face --ethnicity-data ./data/ethnicity --name-data ./data/name --label-data ./data/label --accessories-file ./output/step2.2/1637990312861/info.json --enhancements-file ./output/step2.1/1639277939/index.json --output ./tmp/nft-debug --image-url https://gangenalumni.s3.us-east-2.amazonaws.com/rinkeby/images/\{id\}.jpg --overwrite --hex
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs").promises;
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const glob = require("glob-promise");
const debugLog = require("debug")("datasets");
const jsonfile = require("jsonfile");
const _ = require("lodash");
const { getName, inspectObject, getImages } = require("../utils");
const Queue = require("../utils/queue");
const options = require("../utils/options")((program) => {
	program.requiredOption(
		"-o, --output <value>",
		"Path to the output dataset directory."
	);
	program.option("-f, --face-data <value>", "Path to face dataset.");
	program.option("-e, --ethnicity-data <value>", "Path to ethnicity dataset.");
	program.option("-n, --name-data <value>", "Path to produced names dataset.");
	program.option(
		"-l, --label-data <value>",
		"Path to produced labels dataset."
	);
	program.option(
		"-af, --accessories-file <value>",
		"Path to accessories output JSON file"
	);
	program.option(
		"-ef, --enhancements-file <value>",
		"Path to enhancements output JSON file"
	);
	program.option(
		"-u, --image-url <value>",
		"A Image URL to associate to metadata. The {ID} placeholder is replaced by the image ID."
	);
	program.option(
		"--overwrite",
		"Determine whether to overwrite the existing dataset files, or leave off the command to simply fill the missing files."
	);
	program.option("--hex", "Output the files using Hex Format");
});
const applyLabel = require("./apply-label");

const apparelLabelSettings = require("./apparel.json");
const headwearLabelSettings = require("./headwear.json");
const cosmeticLabelSettings = require("./cosmetic.json");
const backgroundLabelSettings = require("./background.json");

const {
	input,
	faceData: faceDataInput,
	ethnicityData: ethnicityDataInput,
	nameData: nameDataInput,
	labelData: labelDataInput,
	accessoriesFile,
	enhancementsFile,
	output: outputDir,
	imageUrl,
	overwrite,
	hex: useHex
} = options;

const facialHairMapping = {
	Hipster: "Stubble",
	"Grand Goatee": "Extended Goatee",
	"Petite Goatee": "Goatee",
	Goatee: "Circle Beard",
	Lion: "Chin Curtain"
};
// const makeupMapping = {
// 	Makeup: "Youthful",
// 	"Makeup 2": "Light",
// 	"Makeup 3": "Casual",
// 	"Makeup 4": "Fair",
// 	"No Makeup": "Au Naturel"
// };
const ethnicityMapping = {
	White: "Caucasian",
	Black: "African",
	Indian: "Southern Asian",
	Latino_Hispanic: "Latino/Hispanic"
};

const contractMetadata = {
	name: "Gangen Alumni",
	description: ``,
	image:
		"https://gangenalumni.com/wp-content/uploads/2021/12/cropped-GangenAlumni-Icon.png", // TODO: Move to IPFS
	external_link: "https://gangenalumni.com"
};

// Unique Id for Folder to store files in...
// const currentTs = Date.now();

debugLog(`Output Directory: ${outputDir}`);

// Create dir
mkdirp.sync(outputDir);

(async () => {
	const contractDescription = await fs.readFile(
		path.resolve(__dirname, "./md/contract-description.md"),
		"utf-8"
	);
	contractMetadata.description = contractDescription;

	await jsonfile.writeFile(
		path.resolve(outputDir, "contract.json"),
		contractMetadata
	);

	const descriptionTemplate = await fs.readFile(
		path.resolve(__dirname, "./md/description-template.md"),
		"utf-8"
	);

	let images = [];
	if (input) {
		images = await getImages(input);
	}
	const faceDataSources = await glob(`${faceDataInput}/*.json`, {
		absolute: true
	});
	const ethnDataSources = await glob(`${ethnicityDataInput}/*.json`, {
		absolute: true
	});
	const nameDataSources = await glob(`${nameDataInput}/*.json`, {
		absolute: true
	});
	const labelDataSources = await glob(`${labelDataInput}/*.json`, {
		absolute: true
	});
	const accessoriesDataSource = path.resolve(accessoriesFile);
	const enhancementsDataSource = path.resolve(enhancementsFile);
	const accessoriesData = await jsonfile.readFile(accessoriesDataSource);
	const enhancementsData = await jsonfile.readFile(enhancementsDataSource);

	const sources = (images.length > 0 ? images : faceDataSources).map(
		(filepath) => {
			const fdName = getName(filepath);
			const findFn = (fp) => {
				const edName = getName(fp);
				return fdName === edName;
			};
			const faceFilepath =
				images.length > 0 ? faceDataSources.find(findFn) : filepath;
			const ethnFilepath = ethnDataSources.find(findFn);
			const nameFilepath = nameDataSources.find(findFn);
			const labelFilepath = labelDataSources.find(findFn);

			return {
				id: fdName,
				face: faceFilepath,
				ethnicity: ethnFilepath,
				name: nameFilepath,
				label: labelFilepath,
				image: filepath
			};
		}
	);

	const q = new Queue(
		async ({ files }) => {
			const { id } = files;
			const accessories =
				_.get(accessoriesData, `accessoriesAdded`, {})[id] || {};
			const enhancements = _.get(
				enhancementsData.find(({ id: dataId }) => id === dataId),
				"enhancements",
				[]
			);
			const outputFilename = !useHex
				? id
				: _.padStart(parseInt(id, 10).toString(16), 64, "0");
			const outputFile = path.join(outputDir, `${outputFilename}.json`);
			if (!overwrite) {
				try {
					await fs.access(outputFile, fs.F_OK); // try access the file to determine if it exists.
					return { files, output: outputFile, skipped: true }; // return if successful access
				} catch (e) {
					// ...
				}
			}

			const faceData = files.face ? await jsonfile.readFile(files.face) : {};
			const ethnicityData = files.ethnicity
				? await jsonfile.readFile(files.ethnicity)
				: {};
			const labelData = files.label ? await jsonfile.readFile(files.label) : {};
			const nameData = files.name ? await jsonfile.readFile(files.name) : {};

			const { name = "" } = nameData;

			let image = "";
			if (imageUrl) {
				image = imageUrl.replaceAll("{ID}", id).replaceAll("{id}", id);
			} else if (images.length) {
				// ...
			}
			const attributes = [];

			const faceDetails = faceData.FaceDetails[0];

			// Gender
			let gender = faceDetails.Gender.Value;
			if (
				faceDetails.Gender.Confidence <= 0.8 ||
				(gender === "Female" &&
					(faceDetails.Beard.Value === true ||
						faceDetails.Mustache.Value === true))
			) {
				gender = "Non-Binary";
			}
			// Age
			const age =
				Math.floor(
					Math.random() * (faceDetails.AgeRange.High - faceDetails.AgeRange.Low)
				) + faceDetails.AgeRange.Low;
			// Mood
			const mood = _.startCase(faceDetails.Emotions[0].Type.toLowerCase());
			// Eyewear
			let eyewear;
			if (faceDetails.Sunglasses.Value) {
				eyewear = "Sunglasses";
			} else if (faceDetails.Eyeglasses.Value) {
				eyewear = "Eyeglasses";
			}
			// Features
			// -- Mouth
			if (faceDetails.Smile.Value) {
				attributes.push({
					trait_type: "Features",
					value: "Smiling"
				});
			}
			attributes.push({
				trait_type: "Features",
				value: `Mouth ${faceDetails.MouthOpen.Value ? "Open" : "Closed"}`
			});
			attributes.push({
				trait_type: "Features",
				value: `Eyes ${faceDetails.EyesOpen.Value ? "Open" : "Closed"}`
			});
			// -- Facing
			let facing = "Forward";
			if (faceDetails.Pose.Yaw < 10) {
				facing = "Left";
			} else if (faceDetails.Pose.Yaw > 10) {
				facing = "Right";
			}
			attributes.push({
				trait_type: "Features",
				value: `Facing ${facing}`
			});

			attributes.push({
				trait_type: "Cast Member #",
				value: id
			});
			attributes.push({
				trait_type: "Gender",
				value: gender
			});
			attributes.push({
				trait_type: "Age",
				value: age
			});
			attributes.push({
				trait_type: "Mood",
				value: mood
			});
			if (eyewear) {
				attributes.push({
					trait_type: "Eyewear",
					value: eyewear
				});
			}

			ethnicityData.forEach((eth) => {
				if (eth.value > 0.25) {
					attributes.push({
						trait_type: "Ethnicity",
						value:
							typeof ethnicityMapping[eth.name] === "undefined"
								? eth.name
								: ethnicityMapping[eth.name]
					});
				}
			});

			// Accessories are quite straight forward
			Object.entries(accessories).forEach(([, value]) => {
				const fValue = _.startCase(value.replaceAll("-", " "));
				attributes.push({
					trait_type: "Accessory",
					value: fValue
				});
			});

			enhancements.forEach((e) => {
				if (e.name === "Beards") {
					let value = _.startCase(e.type);
					if (typeof facialHairMapping[value] !== "undefined") {
						value = facialHairMapping[value];
					}
					attributes.push({
						trait_type: "Facial Hair",
						value
					});
				}
				// if (e.name === "Makeup") {
				// 	let value = e.type;
				// 	if (typeof makeupMapping[e.type] !== "undefined") {
				// 		value = makeupMapping[e.type];
				// 	}
				// 	attributes.push({
				// 		trait_type: "Makeup",
				// 		value
				// 	});
				// }
			});

			// Label Attributes
			// -- Headwear
			if (
				!_.isUndefined(
					labelData.objects.find((o) => o.name === "Hat" && o.score > 0.6)
				)
			) {
				// Has hat
				let hatLabel = {};
				labelData.labels.forEach((label) => {
					const labelSetting = headwearLabelSettings.find(
						(setting) => setting.name === label.description
					);
					if (!_.isUndefined(labelSetting)) {
						if (label.score > labelSetting.score) {
							if (label.score > hatLabel.score || _.isEmpty(hatLabel)) {
								hatLabel = label;
							}
						}
					}
				});
				if (_.isEmpty(hatLabel)) {
					const foundHatLabel = labelData.labels.find(
						(label) => label.description === "Hat" && label.score > 0.8
					);
					if (!_.isUndefined(foundHatLabel)) {
						hatLabel = foundHatLabel;
					}
				}
				if (!_.isEmpty(hatLabel)) {
					attributes.push({
						trait_type: "Headwear",
						value: hatLabel.description
					});
				}
			}
			// The rest of the labels which have group management ...
			const apparelLabels = []; // { label, setting }
			const cosmeticLabels = []; // { label, setting }
			const backgroundLabels = []; // { label, setting }
			labelData.labels.forEach((label) => {
				// -- Apparel
				applyLabel(apparelLabels, label, apparelLabelSettings);
				// -- Cosmetics
				applyLabel(cosmeticLabels, label, cosmeticLabelSettings);
				// -- Background
				applyLabel(backgroundLabels, label, backgroundLabelSettings);
			});

			apparelLabels.forEach(({ label }) => {
				attributes.push({
					trait_type: "Apparel",
					value: label.description
				});
			});
			// TODO: Should add "Eye liner" to id 33 -- Fine tune the Settings.
			cosmeticLabels.forEach(({ label }) => {
				attributes.push({
					trait_type: "Cosmetics",
					value: label.description
				});
			});
			backgroundLabels.forEach(({ label }) => {
				attributes.push({
					trait_type: "Background",
					value: label.description
				});
			});

			const attrText = attributes
				.map((attr) => {
					return `- ${attr.trait_type}: ${attr.value}`;
				})
				.join("\n");

			const description = descriptionTemplate
				.replaceAll("{{ name }}", name)
				.replaceAll("{{ id }}", id)
				.replaceAll("{{ attributes }}", attrText);

			const result = {
				name,
				description,
				external_url: `${contractMetadata.external_link}?ref=md_external&ref_value=${id}`,
				image,
				attributes
			};

			await jsonfile.writeFile(outputFile, result);

			return { files, output: outputFile };
		},
		{
			batchDelay: 200,
			concurrent: 5,
			maxRetries: 3,
			retryDelay: 1000
		}
	);

	// Queue the images for filtering.
	console.log(chalk.yellow(`Processing dataset to produce NFT metadata...`));
	sources.forEach((files, i) => {
		q.push({ files, i });
	});

	q.on("task_failed", (taskId, err) => {
		console.log(chalk.red(`[${taskId}] Could not process file`));
		console.error(inspectObject(err));
	});

	q.on("task_finish", (taskId, result) => {
		console.log(
			chalk.green(`[${taskId}] Successfully produced metadata`),
			result
		);
	});

	await new Promise((resolve) => {
		q.on("drain", () => {
			resolve();
		});
	});

	console.log(chalk.green(`All done!`));
})();
