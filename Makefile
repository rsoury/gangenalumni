VERSION := 1.0.0

.PHONY: default
default:
	# Compiling...
	make clean
	make nft

.PHONY: clean
clean:
	rm -rf ./bin/nft

.PHONY: nft
nft:
	# Compiling Enhance script...
	go build -o bin/nft ./cmd
	chmod +x bin/nft
