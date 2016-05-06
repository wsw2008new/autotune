require 'work_dir/base'

module WorkDir
  # A static website
  class Phantom < Base
    def capture_screenshot(url)
      return unless phantomjs?
      working_dir do
        # script_path = File.expand_path('../screenshot.js', __FILE__).to_s
        script_path2 = File.expand_path('../screenshot2.js', __FILE__).to_s
        # phantomjs script_path, url
        phantomjs script_path2, url

        # pixel_ratio_path = File.expand_path('../pixelratio.js', __FILE__).to_s
        # phantomjs pixel_ratio_path, url, '~/Desktop/testImg.jpg', '2'
        # screenshots = [
        #   {:dimensions => [970,300],
        #     :filename => './screenshots/large.png'},
        #   {:dimensions => [720,300],
        #     :filename => './screenshots/medium.png'},
        #   {:dimensions => [400,200],
        #     :filename => './screenshots/small.png'}
        # ];
        # screenshots = [
        #   [ ['970','300'], './screenshots/large.png'],
        #   [ ['720','300'], './screenshots/medium.png'],
        #   [ ['400','200'], './screenshots/small.png']
        # ];
        #
        # screenshots.each do |image|
        #   phantomjs pixel_ratio_path, url, image[1], image[0][0], image[0][1], '2'
        #   #  phantomjs pixelratio.js [url] [file] [pixelRatio]
        # end

      end
    end

    def screenshots
      glob('screenshots/*')
    end

    # Is phantomJS installed?
    def phantomjs?
      cmd 'which', 'phantomjs'
      return true
    rescue
      return false
    end

    private

    def phantomjs(*args)
      cmd(*['phantomjs', '--disk-cache=true'] + args)
    end

  end
end
