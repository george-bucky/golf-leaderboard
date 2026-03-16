class Fore < Formula
  desc "Terminal golf leaderboard for live events and player scorecards"
  homepage "https://github.com/george-bucky/golf-leaderboard"
  url "https://github.com/george-bucky/golf-leaderboard/archive/442336ce30983ad81334a4b29a5099f925369680.tar.gz"
  sha256 "d4901e168cbedbb5bb290f6f1ba0f7b4016d85315ada69636ac5db4a3d35e9bd"
  license "ISC"
  version "0.0.1"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    package_dir = Dir[libexec/"lib/node_modules/*"].first
    odie "Unable to find installed Fore Golf Scores files." unless package_dir

    log_dir = var/"log"
    log_dir.mkpath
    log_link = Pathname.new(package_dir)/"leaderboard.log"
    log_link.delete if log_link.exist? || log_link.symlink?
    log_link.make_symlink(log_dir/"fore-golf-scores.log")

    (bin/"fore").write <<~SH
      #!/bin/bash
      if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        cat <<'EOF'
      Fore Golf Scores

      Usage:
        fore
        fore --help
        fore --version
      EOF
        exit 0
      fi

      if [[ "$1" == "--version" || "$1" == "-v" ]]; then
        echo "#{version}"
        exit 0
      fi

      exec "#{Formula["node"].opt_bin}/node" "#{package_dir}/index.js" "$@"
    SH
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/fore --version")
  end
end
