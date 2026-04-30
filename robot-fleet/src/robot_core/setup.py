from setuptools import find_packages, setup

package_name = "robot_core"

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
    description="Core state machine node for DishPatch robot fleet",
    license="Apache-2.0",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "core_node = robot_core.core_node:main",
        ],
    },
)
