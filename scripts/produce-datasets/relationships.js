/**
 * Data Step 2 -- After production of Face Dectection Datasets -- produce-datasets/face.js
 * Produce Relationships Dataset -- which produces an array of Family Units comprised of Character Ids
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs").promises;
const chalk = require("chalk");
const mkdirp = require("mkdirp");
const debugLog = require("debug")("datasets");
const jsonfile = require("jsonfile");
const _ = require("lodash");
const glob = require("glob-promise");
const { Rekognition } = require("aws-sdk");
const chance = require('chance');
const Queue = require("../utils/queue");
const options = require("../utils/options")((program) => {
	program.requiredOption(
		"-o, --output <value>",
		"Path to the output dataset directory."
	);
	program.requiredOption("-f, --face-data <value>", "Path to face dataset.");
	program.requiredOption(
		"-e, --ethnicity-data <value>",
		"Path to ethnicity dataset."
	);
	program.option(
		"--overwrite",
		"Determine whether to overwrite the existing dataset files, or leave off the command to simply fill the missing files."
	);
});
const { getImages, getName } = require("../utils");

const {
	input,
	faceData: faceDataInput,
	ethnicityData: ethnicityDataInput,
	output: outputDir,
	overwrite
} = options;

debugLog(`Output Directory: ${outputDir}`);

const comparisonsDir = path.join(outputDir, "comparisons");

// Create dir
mkdirp.sync(outputDir);
mkdirp.sync(comparisonsDir);

const rekognition = new Rekognition();

const compareFaces = async (sourceImgPath, targetImgPath) => {
	const sourceId = getName(sourceImgPath);
	const targetId = getName(targetImgPath);
	const comparison = (
		(await Promise.all(
			[
				[sourceId, targetId],
				[targetId, sourceId]
			].map(async (pair) => {
				const comparisonPath = path.join(
					comparisonsDir,
					`${pair[0]}-${pair[1]}.json`
				);
				const stat = await fs.lstat(comparisonPath);
				if (!stat.isFile()) {
					return false;
				}
				const result = await jsonfile.readFile(comparisonPath);
				return result;
			})
		)) || []
	).find((result) => !_.isEmpty(result));

	if (!_.isEmpty(comparison)) {
		return comparison;
	}

	const source = await fs.readFile(sourceImgPath);
	const target = await fs.readFile(targetImgPath);
	const response = await rekognition
		.compareFaces({
			SourceImage: {
				Bytes: Buffer.from(source).toString("base64")
			},
			TargetImage: {
				Bytes: Buffer.from(target).toString("base64")
			}
		})
		.promise();

	const result = {
		similarity: response.FaceMatches[0].Similarity,
		sourceId,
		targetId,
		response
	};

	// Cache the result
	await jsonfile.writeFile(
		path.join(comparisonsDir, `${sourceId}-${targetId}.json`),
		result
	);

	return result;
};

const sameEthnicity = (ethn1, ethn2) => {
  if(ethn1.length !== ethn2.length){
    return false;
  }
  const checks = [];
  ethn1.forEach(({ name }) => {
    const match = ethn2.find(ethn => name === ethn.name);
    if(!_.isUndefined(match)){
      checks.push(true);
    }
  });
  if(checks.length === ethn1.length){
    return true;
  }

  return false;
}

const similarEthnicity = (ethn1, ethn2) => {
  if(ethn1.length !== ethn2.length){
    return false;
  }
  const prominentTargetEthn = eth2.reduce((r, c) => {
    if(_.isEmpty(r)){
      r.push(c);
      return r;
    }
    // TODO: Deterine similar ethnicity -- Consider if there are two ethncities with the same value.
    if(c.value === r[0].value){
      r.push(c);
      return r;
    }
    return r;
  }, []);

  const checks = []
  prominentTargetEthn.forEach(({ name }) => {
    const match = ethn1.find(ethn => name === ethn.name);
    if(!_.isUndefined(match)){
      checks.push(true);
    }
  });
  if(checks.length === prominentTargetEthn.length){
    return true;
  }

  return false;
}

(async () => {
	const sourceImages = await getImages(input);
	const faceDataSources = await glob(`${faceDataInput}/*.json`, {
		absolute: true
	});
	const ethnDataSources = await glob(`${ethnicityDataInput}/*.json`, {
		absolute: true
	});

	const characters = {};
	for (let i = 0; i < faceDataSources.length; i += 1) {
		const faceFile = faceDataSources[i];
		const faceData = faceFile ? await jsonfile.readFile(faceFile) : {};
		const faceDetails = faceData.FaceDetails[0];
		// Determine Age
		let age =
			Math.floor(
				Math.random() * (faceDetails.AgeRange.High - faceDetails.AgeRange.Low)
			) +
			(faceDetails.AgeRange.Low === 0 && faceDetails.AgeRange.High <= 3
				? faceDetails.AgeRange.Low
				: 1);
		const name = getName(faceFile);
		characters[name].age = age;
	}

	if (Object.keys(characters).length !== faceDataSources.length) {
		throw new Error("Face element has been skipped");
	}
	console.log(
		chalk.yellow(
			`${
				Object.entries(characters).filter(([, v]) => v.age === "< 1").length
			} ages < 1`
		)
	);
	console.log(chalk.green(`Ages processed`));

	const q = new Queue(
		async ({ image }) => {
			const name = getName(image);
			const outputFile = path.join(outputDir, `${name}.json`);
			if (!overwrite) {
				try {
					await fs.access(outputFile, fs.F_OK); // try access the file to determine if it exists.
					return { image, output: outputFile, skipped: true }; // return if successful access
				} catch (e) {
					// ...
				}
			}
			const faceFile = faceDataSources.find(
				(filePath) => getName(filePath) === name
			);
			const ethnFile = ethnDataSources.find(
				(filePath) => getName(filePath) === name
			);
			const faceData = faceFile ? await jsonfile.readFile(faceFile) : {};
			const ethnData = ethnFile ? await jsonfile.readFile(ethnFile) : {};
      const ethnicity = ethnData.filter(eth => eth.value > 0.25)
      const gender = faceDetails.Gender.Value

			const faceDetails = faceData.FaceDetails[0];

			const spouseCohort = [];
			const parentCohort = [];

      for(let i = 0; i < faceDataSources.length; i ++){
        const cmpFaceFile = faceDataSources[i];
        const cmpName = getName(cmpFaceFile);
        if(name === cmpName){
          continue;
        }
        const {age} = characters[name].age ? ;
        const {age: cmpAge} = characters[cmpName];
        const cmpFaceData = faceFile ? await jsonfile.readFile(faceFile) : {};
        const cmpFaceDetails = faceData.FaceDetails[0];
        const cmpEthnFile = ethnDataSources.find(
          (filePath) => getName(filePath) === name
        );
        const cmpEthnData = cmpEthnFile ? await jsonfile.readFile(cmpEthnFile) : {};
        const cmpEthnicity = cmpEthnData.filter(eth => eth.value > 0.25)

        // For Spouse
        if(age >= 20){
          // Check Genders
          const cGender = gender.toLowerCase()
          let isOppositeGender = false;
          if(cGender === 'male') {
            isOppositeGender = cmpFaceData.Gender.Value.toLowerCase() === "female";
          }else if (cGender === 'female'){
            isOppositeGender = cmpFaceData.Gender.Value.toLowerCase() === "male";
          }
          if(isOppositeGender || Math.random() <= 0.1){ // 10% chance at intersexual spousal -- however, both candidates need to fall into each other's cohort...
            const ageDifference = Math.abs(age - cmpAge);
            const r = chance.weighted(_.range(0, 21), _.range(20, -1, -1)
            if(r <= ageDifference){ // The greater the difference, the more unlikely the candidate.
              const r2 = Math.random(); // Let's give a 20% chance if the couple is interracial
              if(sameEthnicity(ethnicity, cmpEthnicity) || r2 <= 0.2){
                spouseCohort.push(cmpName)
                continue; // Cannot be a parent, if it's their spouse
              }
            }
          }
        }

        // For Parent
        const ageDifference = cmpAge - age; // No absolute here because a parent must always have > age
        if(ageDifference >= 18){
          if(similarEthnicity(ethnicity, cmpEthnicity)){

          }
        }

        // TODO: We'll to store the result of a comparison -- as the initial loop re-compares the two, there should simply be a skip.
      }

			const result = {
				age: ages[name] // TODO: Metadata needs the following check to be applied -- !ages[name] ? "< 1" : ages[name]
			};

			return { image, output: outputFile };
		},
		{
			batchDelay: 200,
			concurrent: 5
		}
	);

	// Queue the images for filtering.
	console.log(
		chalk.yellow(`Processing relationships analysis of input images...`)
	);
	sourceImages.forEach((image, i) => {
		q.push({ image, i });
	});

	q.on("task_failed", (taskId, err) => {
		console.log(chalk.red(`[${taskId}] Could not process image`));
		console.error("Received failed status: ", err.message);
	});

	q.on("task_finish", async (taskId, result) => {
		console.log(
			chalk.green(`[${taskId}] Successfully processed image`),
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
