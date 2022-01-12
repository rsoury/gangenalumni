package main

import (
	"math/rand"
	"time"
)

type EnhancementType struct {
	Name              string
	Probability       float64
	ScrollRequirement int
}

type Enhancement struct {
	Name              string
	Probability       float64
	Types             []EnhancementType
	GenderRequirement string
}

var (
	enhancements = []Enhancement{
		{
			Name:              "Beards",
			Probability:       0.5,
			GenderRequirement: "Male",
			Types: []EnhancementType{
				{
					Name:        "Full beard",
					Probability: 0.3,
				},
				{
					Name:        "Hipster",
					Probability: 0.2,
				},
				{
					Name:        "Goatee",
					Probability: 0.2,
				},
				{
					Name:        "Mustache",
					Probability: 0.2,
				},
				{
					Name:        "Grand goatee",
					Probability: 0.2,
				},
				{
					Name:        "Lion",
					Probability: 0.05,
				},
				{
					Name:        "Petite Goatee",
					Probability: 0.05,
				},
			},
		},
		{
			Name:              "Makeup",
			Probability:       0.5,
			GenderRequirement: "Female",
			Types: []EnhancementType{
				{
					Name:        "Makeup 3",
					Probability: 0.05,
				},
				{
					Name:        "Makeup 4",
					Probability: 0.05,
				},
				{
					Name:        "Contouring",
					Probability: 0.1,
				},
				{
					Name:        "Blush",
					Probability: 0.05,
				},
				{
					Name:        "Eyelashes",
					Probability: 0.2,
				},
				{
					Name:        "Eyebrows",
					Probability: 0.3,
				},
				{
					Name:        "Eyeliner",
					Probability: 0.1,
				},
				{
					Name:        "Foundation",
					Probability: 0.1,
				},
				{
					Name:        "No makeup",
					Probability: 0.5,
				},
				{
					Name:        "Glossy",
					Probability: 0.1,
				},
				{
					Name:        "Eyeshadows",
					Probability: 0.1,
				},
				{
					Name:              "Dark Matte",
					Probability:       0.1,
					ScrollRequirement: 800,
				},
				{
					Name:              "Dark",
					Probability:       0.1,
					ScrollRequirement: 800,
				},
				{
					Name:              "Bright Glossy",
					Probability:       0.1,
					ScrollRequirement: 800,
				},
				{
					Name:              "Dark Glossy",
					Probability:       0.1,
					ScrollRequirement: 800,
				},
			},
		},
		{
			Name:        "Sizes",
			Probability: 0.3,
			Types: []EnhancementType{
				{
					Name:        "Big Face",
					Probability: 0.5,
				},
				{
					Name:        "Cheekbones",
					Probability: 0.1,
				},
				{
					Name:        "Small Face",
					Probability: 0.01,
				},
			},
		},
	}
)

// Shuffle the Types and return a new Types array
func (e *Enhancement) ShuffleTypes() []EnhancementType {
	var vals []EnhancementType
	vals = append(vals, e.Types...) // Cleaner copy

	r := rand.New(rand.NewSource(time.Now().Unix()))
	ret := make([]EnhancementType, len(vals))
	n := len(vals)
	for i := 0; i < n; i++ {
		randIndex := r.Intn(len(vals))
		ret[i] = vals[randIndex]
		vals = append(vals[:randIndex], vals[randIndex+1:]...)
	}
	return ret
}
