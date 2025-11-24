{ pkgs }: {
  deps = [
    pkgs.python310
    pkgs.python310Packages.fastapi
    pkgs.python310Packages.uvicorn
  ];
}
