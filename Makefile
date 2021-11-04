EXECUTABLE := snapcamera
VERSION := 1.0.0

.PHONY: default
default: ${EXECUTABLE}

.PHONY: clean
clean:
	rm -rf ./bin/${EXECUTABLE}

.PHONY: ${EXECUTABLE}
${EXECUTABLE}:
	# Compiling...
	go build -o bin/${EXECUTABLE}
	chmod +x bin/${EXECUTABLE}