let
  # Version of the nix dependencies to install
  versions = {
    yarn2nix = "2b29eafedd3822095187ba20a472c2b01642b09d";
  };
  
  pkgs = import <nixpkgs> {};

  callPackage = pkgs.lib.callPackageWith (pkgs // ownpkgs // lib);

  inherit (import (builtins.fetchGit {
    name = "yarn2nix";
    url = "https://github.com/moretea/yarn2nix.git";
    rev = versions.yarn2nix;
  }) { inherit pkgs; })
    mkYarnWorkspace;

  lib = {
    inherit callPackage;
  };

  js-packages = mkYarnWorkspace {
    src = ./.;
    buildPhase = ''
       yarn build || true
    '';
  };

  ownpkgs = js-packages;

in ownpkgs

