from setuptools import find_packages, setup

package_name = "costmap_viz"

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
    description="Republishes a Nav2 costmap at a raised z so it does not z-fight the map",
    license="Apache-2.0",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "costmap_z_offset_node = costmap_viz.costmap_z_offset_node:main",
        ],
    },
)
