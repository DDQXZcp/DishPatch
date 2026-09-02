from setuptools import find_packages, setup

package_name = "rosbridge_relay"

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
    maintainer="DishPatch",
    maintainer_email="dishpatch@todo.todo",
    description="Relays a robot's topics to a remote rosbridge server",
    license="Apache-2.0",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "relay_node = rosbridge_relay.relay_node:main",
        ],
    },
)
