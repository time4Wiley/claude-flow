/**
 * @file hello.cpp
 * @brief A comprehensive Hello World program demonstrating modern C++ features
 * 
 * This program showcases various C++ features including:
 * - Object-oriented programming with classes
 * - Templates and generic programming
 * - Modern C++11/14/17/20 features
 * - Exception handling
 * - STL containers and algorithms
 * - Smart pointers and RAII
 */

#include <iostream>
#include <string>
#include <vector>
#include <memory>
#include <algorithm>
#include <chrono>
#include <thread>
#include <optional>
#include <variant>
#include <format> // C++20

// Interface for different greeting strategies
class IGreeter {
public:
    virtual ~IGreeter() = default;
    virtual std::string greet(const std::string& name) const = 0;
};

// Basic greeter implementation
class SimpleGreeter : public IGreeter {
private:
    std::string prefix_;
    
public:
    explicit SimpleGreeter(const std::string& prefix = "Hello") 
        : prefix_(prefix) {}
    
    std::string greet(const std::string& name) const override {
        return std::format("{}, {}!", prefix_, name.empty() ? "World" : name);
    }
};

// Greeter with timestamp
class TimestampedGreeter : public IGreeter {
private:
    std::unique_ptr<IGreeter> wrapped_greeter_;
    
public:
    explicit TimestampedGreeter(std::unique_ptr<IGreeter> greeter)
        : wrapped_greeter_(std::move(greeter)) {}
    
    std::string greet(const std::string& name) const override {
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        
        return std::format("[{}] {}", 
            std::put_time(std::localtime(&time_t), "%Y-%m-%d %H:%M:%S"),
            wrapped_greeter_->greet(name));
    }
};

// Template function for generic greeting
template<typename T>
void printGreeting(const T& greeter, const std::string& name) {
    std::cout << greeter.greet(name) << std::endl;
}

// Modern C++ features demonstration
class ModernCppDemo {
public:
    // Using auto and range-based for loops
    static void demonstrateContainers() {
        std::cout << "\n=== STL Containers Demo ===" << std::endl;
        
        // Vector with initializer list
        std::vector<std::string> languages{"C++", "Python", "JavaScript", "Go", "Rust"};
        
        // Range-based for loop
        std::cout << "Programming languages:" << std::endl;
        for (const auto& lang : languages) {
            std::cout << "  - " << lang << std::endl;
        }
        
        // Using algorithms
        std::sort(languages.begin(), languages.end());
        std::cout << "\nSorted languages:" << std::endl;
        for (size_t i = 0; i < languages.size(); ++i) {
            std::cout << "  " << i + 1 << ". " << languages[i] << std::endl;
        }
    }
    
    // Lambda expressions and functional programming
    static void demonstrateLambdas() {
        std::cout << "\n=== Lambda Expressions Demo ===" << std::endl;
        
        std::vector<int> numbers{1, 2, 3, 4, 5};
        
        // Lambda with capture
        int multiplier = 2;
        std::transform(numbers.begin(), numbers.end(), numbers.begin(),
            [multiplier](int n) { return n * multiplier; });
        
        std::cout << "Numbers doubled: ";
        for (const auto& n : numbers) {
            std::cout << n << " ";
        }
        std::cout << std::endl;
        
        // Generic lambda (C++14)
        auto sum = [](auto a, auto b) { return a + b; };
        std::cout << "Sum(5, 3) = " << sum(5, 3) << std::endl;
        std::cout << "Sum(2.5, 3.5) = " << sum(2.5, 3.5) << std::endl;
    }
    
    // Optional and variant (C++17)
    static std::optional<std::string> getGreeting(bool provide) {
        if (provide) {
            return "Hello from optional!";
        }
        return std::nullopt;
    }
    
    // Structured bindings (C++17)
    static std::pair<std::string, int> getLanguageInfo() {
        return {"C++", 20}; // C++20
    }
};

// Async greeting with std::async
std::string asyncGreet(const std::string& name, int delay_ms) {
    std::this_thread::sleep_for(std::chrono::milliseconds(delay_ms));
    return std::format("Hello, {}! (after {}ms)", name, delay_ms);
}

// Main function demonstrating all features
int main(int argc, char* argv[]) {
    std::cout << "=== C++ Hello World ===" << std::endl << std::endl;
    
    // Basic greeting
    SimpleGreeter simple_greeter;
    std::cout << simple_greeter.greet("") << std::endl;
    
    // Greeting with name from command line
    std::string name = (argc > 1) ? argv[1] : "C++ Developer";
    std::cout << simple_greeter.greet(name) << std::endl;
    
    // Using smart pointers and decorators
    auto timestamped = std::make_unique<TimestampedGreeter>(
        std::make_unique<SimpleGreeter>("Greetings")
    );
    printGreeting(*timestamped, "Modern C++ User");
    
    // Demonstrate modern features
    ModernCppDemo::demonstrateContainers();
    ModernCppDemo::demonstrateLambdas();
    
    // Optional usage
    std::cout << "\n=== Optional Demo ===" << std::endl;
    if (auto greeting = ModernCppDemo::getGreeting(true); greeting.has_value()) {
        std::cout << greeting.value() << std::endl;
    }
    
    // Structured bindings
    auto [language, version] = ModernCppDemo::getLanguageInfo();
    std::cout << "\nLanguage: " << language << ", Version: C++" << version << std::endl;
    
    // Async operation
    std::cout << "\n=== Async Demo ===" << std::endl;
    auto future_greeting = std::async(std::launch::async, asyncGreet, "Async World", 500);
    std::cout << "Waiting for async greeting..." << std::endl;
    std::cout << future_greeting.get() << std::endl;
    
    // Using concepts (C++20)
    auto print_size = []<typename T>(const T& container) 
        requires requires { container.size(); } {
        std::cout << "Container size: " << container.size() << std::endl;
    };
    
    std::vector<int> vec{1, 2, 3};
    print_size(vec);
    
    std::cout << "\nProgram completed successfully!" << std::endl;
    return 0;
}