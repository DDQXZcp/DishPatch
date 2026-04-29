from setuptools import find_packages, setup

package_name = "robot_location_publisher"

setup(
    name=package_name,
    version="0.0.1",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", [f"resource/{package_name}"]),
        (f"share/{package_name}", ["package.xml"]),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="Herman Tang",
    maintainer_email="zhiheng.tang@anu.edu.au",
    description="Simulated robot location publisher for ROS 2 Jazzy",
    license="Apache-2.0",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "location_publisher = robot_location_publisher.location_publisher:main",
        ],
    },
)
