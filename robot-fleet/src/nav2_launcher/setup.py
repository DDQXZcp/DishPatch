import os
from glob import glob
from setuptools import find_packages, setup

package_name = "nav2_launcher"

setup(
    name=package_name,
    version="0.0.1",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", [f"resource/{package_name}"]),
        (f"share/{package_name}", ["package.xml"]),
        (
            os.path.join("share", package_name, "launch"),
            glob("launch/*.py"),
        ),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="DishPatch",
    maintainer_email="dishpatch@todo.todo",
    description="Minimal Nav2 launcher for multiple robot namespaces",
    license="Apache-2.0",
    entry_points={
        "console_scripts": [],
    },
)
