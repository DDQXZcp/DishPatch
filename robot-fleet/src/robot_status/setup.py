from setuptools import find_packages, setup

package_name = "robot_status"

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
    description="Status node for DishPatch robot fleet",
    license="Apache-2.0",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "status_node = robot_status.status_node:main",
        ],
    },
)
