package config

import (
	"github.com/spf13/viper"
)

type Config struct {
	GRPCAddr             string `mapstructure:"GRPC_ADDR"`
	HTTPAddr             string `mapstructure:"HTTP_ADDR"`
	DockerHost           string `mapstructure:"DOCKER_HOST"`
	RuntimeDockerNetwork string `mapstructure:"RUNTIME_DOCKER_NETWORK"`
	HermesImage          string `mapstructure:"HERMES_IMAGE"`
	CPAPIURL             string `mapstructure:"CP_API_URL"`
	OpenRouterKey        string `mapstructure:"OPENROUTER_API_KEY"`
}

func Load() *Config {
	viper.SetDefault("GRPC_ADDR", ":50051")
	viper.SetDefault("HTTP_ADDR", ":8080")
	viper.SetDefault("DOCKER_HOST", "unix:///var/run/docker.sock")
	viper.SetDefault("RUNTIME_DOCKER_NETWORK", "")
	viper.SetDefault("HERMES_IMAGE", "agenthub/hermes-base:latest")
	viper.SetDefault("CP_API_URL", "http://ts-control-plane:3000")
	viper.AutomaticEnv()

	var cfg Config
	_ = viper.Unmarshal(&cfg)
	return &cfg
}
