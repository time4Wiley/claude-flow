from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="agentic-flow",
    version="1.0.0",
    author="Agentic Flow Team",
    author_email="sdk@agenticflow.dev",
    description="Official Python SDK for Agentic Flow API",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/agentic-flow/sdk-python",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Typing :: Typed",
    ],
    python_requires=">=3.8",
    install_requires=[
        "httpx>=0.25.0",
        "pydantic>=2.0.0",
        "websockets>=12.0",
        "python-dateutil>=2.8.0",
        "typing-extensions>=4.8.0;python_version<'3.11'",
    ],
    extras_require={
        "dev": [
            "pytest>=7.4.0",
            "pytest-asyncio>=0.21.0",
            "pytest-httpx>=0.24.0",
            "black>=23.0.0",
            "mypy>=1.5.0",
            "ruff>=0.1.0",
            "sphinx>=7.0.0",
            "sphinx-rtd-theme>=1.3.0",
        ],
    },
    project_urls={
        "Bug Reports": "https://github.com/agentic-flow/sdk-python/issues",
        "Documentation": "https://docs.agenticflow.dev/sdk/python",
        "Source": "https://github.com/agentic-flow/sdk-python",
    },
)