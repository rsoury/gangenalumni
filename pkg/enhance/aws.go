package main

import (
	"log"

	"github.com/caarlos0/env"
	"github.com/joho/godotenv"
)

// Compatible with "github.com/caarlos0/env"
type AWSConfig struct {
	Region    string `env:"AWS_REGION" envDefault:"us-east-1"`
	AccessId  string `env:"AWS_ACCESS_KEY_ID"`
	AccessKey string `env:"AWS_SECRET_ACCESS_KEY"`
}

func NewAWSEnvConfig() *AWSConfig {
	_ = godotenv.Load()
	config := &AWSConfig{}
	err := env.Parse(config)
	if err != nil {
		log.Fatalf("Cannot Marshal Environment into Config: %v", err.Error())
	}
	return config
}
