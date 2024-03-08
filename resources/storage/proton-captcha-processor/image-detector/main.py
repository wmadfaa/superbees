import sys
import select
import time
import cv2
import numpy as np

def solve_image(buf: bytes):
    nparr = np.frombuffer(buf, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img_gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    ret, thresh = cv2.threshold(img_gray, 180, 255, cv2.THRESH_BINARY_INV)
    contours, hierarchy = cv2.findContours(thresh, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    hierarchy = hierarchy[0]
    for i, c in enumerate(contours):
        if hierarchy[i][2] < 0 and hierarchy[i][3] < 0:
#             cv2.drawContours(img, contours, i, (0, 0, 255), 1)
            ca = cv2.contourArea(c)
            if 1700 < ca < 1800:
                M = cv2.moments(c)
                cX = (M["m10"] / M["m00"]) - 30
                cY = (M["m01"] / M["m00"]) - 30
#                 cv2.drawContours(img, contours, i, (0, 0, 255), 1)
#                 cv2.circle(img, (int(cX), int(cY)),2, (0, 255, 0), 1)
#                 cv2.imwrite("./result.png", img)
                return round(cX, 8), round(cY, 8)
    return None

if __name__ == "__main__":
    if (sys.argv[1] != None):
        fd = open(sys.argv[1],'rb')
        img_str = fd.read()
        fd.close()
        res = solve_image(img_str)
        if (res==None):
            sys.exit(1)
        else:
            print([res[0], res[1]])
    else:
        print(f"no image file path given in args")
        sys.exit(1)  # Exit with an error code