#!/bin/bash

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

install_rust() {
    echo "Rust is not installed. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    source "$HOME/.cargo/env"
}

install_python3() {
    echo "Python3 is not installed. Installing Python3..."
    brew install python@3
}

install_python_requirements() {
    echo "Installing Python requirements..."
    pip3 install -r "$SCRIPT_DIR/image-detector/requirements.txt"
}

compile_rust_code() {
    echo "Compiling Rust code..."
    (cd "$SCRIPT_DIR/pow" || exit
    cargo build --release)
}

main() {
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

    if ! command_exists rustc; then
        if [[ "$(uname)" == "Darwin" ]]; then
            install_rust
        else
            echo "Rust is not installed. Please install Rust manually."
            exit 1
        fi
    fi

    if ! command_exists python3; then
        if [[ "$(uname)" == "Darwin" ]]; then
            install_python3
        else
            echo "Python3 is not installed. Please install Python3 manually."
            exit 1
        fi
    fi

    install_python_requirements

    compile_rust_code

    echo "Installation complete!"
}

main
