# CMake configuration for C++ Hello World
cmake_minimum_required(VERSION 3.20)
project(hello_cpp VERSION 1.0.0 LANGUAGES CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Add compile options
add_compile_options(
    -Wall
    -Wextra
    -Wpedantic
    -Werror
    $<$<CONFIG:Debug>:-g>
    $<$<CONFIG:Release>:-O3>
)

# Create executable
add_executable(hello hello.cpp)

# Set properties
set_target_properties(hello PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)

# Installation rules
install(TARGETS hello
    RUNTIME DESTINATION bin
)

# Add a custom target to run the program
add_custom_target(run
    COMMAND hello
    DEPENDS hello
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}/bin
    COMMENT "Running Hello World program"
)